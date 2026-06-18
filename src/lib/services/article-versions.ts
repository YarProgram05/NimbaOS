import { prisma } from '@/lib/db'

export interface ArticleVersionMeta {
  id: string
  nmId: number
  dateFrom: Date
  dateTo: Date | null
  vendorCode: string
  costPrice: number | null
}

type ArticleVersionRaw = {
  id: string
  nmId: number
  dateFrom: Date
  dateTo: Date | null
  vendorCode: string
  costPrice: { toString(): string } | number | string | null
}

function d(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

export async function findArticleVersionsForPeriod(
  wbAccountId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<ArticleVersionMeta[]> {
  const delegate = (prisma as unknown as {
    articleVersion?: {
      findMany(args: unknown): Promise<ArticleVersionRaw[]>
    }
  }).articleVersion

  const rows = delegate
    ? await delegate.findMany({
      where: {
        wbAccountId,
        dateFrom: { lte: dateTo },
        OR: [
          { dateTo: null },
          { dateTo: { gte: dateFrom } },
        ],
      },
      orderBy: [{ nmId: 'asc' }, { dateFrom: 'asc' }],
    })
    : await prisma.$queryRaw<ArticleVersionRaw[]>`
      SELECT id, "nmId", "dateFrom", "dateTo", "vendorCode", "costPrice"
      FROM "article_versions"
      WHERE "wbAccountId" = ${wbAccountId}
        AND "dateFrom" <= ${dateTo}
        AND ("dateTo" IS NULL OR "dateTo" >= ${dateFrom})
      ORDER BY "nmId" ASC, "dateFrom" ASC
    `

  return rows.map((version) => ({
    id: version.id,
    nmId: version.nmId,
    dateFrom: version.dateFrom,
    dateTo: version.dateTo,
    vendorCode: version.vendorCode,
    costPrice: version.costPrice == null ? null : d(version.costPrice),
  }))
}

export function buildArticleVersionMap(versions: ArticleVersionMeta[]): Map<number, ArticleVersionMeta[]> {
  const result = new Map<number, ArticleVersionMeta[]>()
  for (const version of versions) {
    const rows = result.get(version.nmId) ?? []
    rows.push(version)
    result.set(version.nmId, rows)
  }

  for (const rows of Array.from(result.values())) {
    rows.sort((left, right) => left.dateFrom.getTime() - right.dateFrom.getTime())
  }

  return result
}

export function resolveArticleVersion(
  versionsByNm: Map<number, ArticleVersionMeta[]>,
  nmId: number,
  date: Date | null | undefined,
): ArticleVersionMeta | null {
  const versions = versionsByNm.get(nmId)
  if (!versions?.length || !date) return null

  const day = startOfUtcDay(date).getTime()
  return versions.find((version) => {
    const from = startOfUtcDay(version.dateFrom).getTime()
    const to = version.dateTo ? startOfUtcDay(version.dateTo).getTime() : Number.POSITIVE_INFINITY
    return from <= day && day <= to
  }) ?? null
}

export function articleVersionGroupKey(nmId: number, version: ArticleVersionMeta | null): string {
  return version ? `${nmId}:version:${version.id}` : `${nmId}:base`
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
