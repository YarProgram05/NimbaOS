import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { aggregateReportRows } from '@/lib/reports/aggregate-report-rows'
import { getSyncCoverage } from '@/lib/sync/coverage'
import { fetchAdvertInfoByIds, fetchFullStats, fetchUpdHistory } from '@/lib/wb-api/advertising'
import { WbApiClient } from '@/lib/wb-api/client'
import type {
  WbFullStatsAppType,
  WbFullStatsCampaign,
  WbFullStatsDayItem,
  WbFullStatsMetricPoint,
  WbUpdHistoryItem,
} from '@/types/advertising'
import { SYNC_JOB_KINDS } from '@/types/sync'
import type { ReportData, ReportRow } from '@/types/reports'

type DbRow = Awaited<ReturnType<typeof prisma.realizationReport.findMany>>[number]
type AdNmStatRow = {
  campaignId: string
  nmId: number
  spend: { toString(): string }
}

interface SizeMeta {
  key: string
  label: string
  techSize: string
  wbSize: string | null
  barcode: string | null
  chrtId: number | null
}

interface ReferenceTotals {
  externalAd: number
  selfPurchaseCost: number
  selfPurchaseAmount: number
  selfPurchaseCashback: number
}

interface ArticleVersionMeta {
  id: string
  nmId: number
  dateFrom: Date
  dateTo: Date | null
  vendorCode: string
  costPrice: number | null
}

interface RowIdentity {
  sizeLabel?: string | null
  isSizeRow?: boolean
  parentNmId?: number | null
  parentVendorCode?: string | null
  displayVendorCode?: string
  versionCostPrice?: number | null
}

interface CalculateReportOptions {
  preferPersistedAdStats?: boolean
  preferLiveAdCostTotals?: boolean
}

export const REPORT_CALCULATION_OPTIONS = {
  preferLiveAdCostTotals: true,
} satisfies CalculateReportOptions

const DOC_SALE = '\u041f\u0440\u043e\u0434\u0430\u0436\u0430'
const DOC_RETURN = '\u0412\u043e\u0437\u0432\u0440\u0430\u0442'
const OPERATION_LOGISTICS = '\u041b\u043e\u0433\u0438\u0441\u0442\u0438\u043a\u0430'
const BONUS_TO_CLIENT_SALE = '\u041a \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u0438 \u043f\u0440\u043e\u0434\u0430\u0436\u0435'
const BONUS_TO_CLIENT_CANCEL = '\u041a \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u043f\u0440\u0438 \u043e\u0442\u043c\u0435\u043d\u0435'
const SUMMARY_LABEL = '\u0418\u0442\u043e\u0433\u043e'
const OPERATION_DEDUCTION = '\u0423\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435'
const WB_PROMOTION_SERVICE = '\u041e\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u0443\u0441\u043b\u0443\u0433 \u00abWB \u041f\u0440\u043e\u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435\u00bb'
const DOMINANT_CAMPAIGN_NM_SHARE = 0.5
const MAX_UPD_HISTORY_DAYS = 31
const ADVERT_NM_ALLOCATION_OVERRIDES = new Map<number, Array<[number, number]>>([
  [34924534, [[164673706, 1]]],
  [35106180, [[167696552, 527], [219179130, 473]]],
  [35312147, [[270773541, 646], [167580986, 354]]],
])
const PROPORTIONAL_ADVERT_ALLOCATION_OVERRIDES = new Set([35106180, 35312147])

export async function calculateReport(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
  options: CalculateReportOptions = {},
): Promise<ReportData> {
  const dfrom = new Date(dateFrom)
  const dto = new Date(dateTo)

  const [
    rows,
    costPrices,
    selfPurchases,
    externalAds,
    overrides,
    articleVersions,
    account,
    products,
    paidStorageRows,
    adNmStatRows,
    orderRows,
    adCampaigns,
    coverage,
  ] =
    await Promise.all([
      prisma.realizationReport.findMany({
        where: {
          wbAccountId,
          OR: [
            {
              rrDt: { gte: dfrom, lte: dto },
            },
            {
              rrDt: null,
              dateFrom: { lte: dto },
              dateTo: { gte: dfrom },
            },
          ],
        },
      }),
      prisma.costPrice.findMany({
        where: { wbAccountId },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.selfPurchase.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      }),
      prisma.externalAd.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
      }),
      prisma.articleOverride.findMany({ where: { wbAccountId } }),
      findArticleVersionsForReport(wbAccountId, dfrom, dto),
      prisma.wbAccount.findUniqueOrThrow({
        where: { id: wbAccountId },
        select: { taxRate: true, lastSyncAt: true, apiKey: true },
      }),
      prisma.product.findMany({
        where: { wbAccountId },
        select: {
          nmId: true,
          vendorCode: true,
          category: true,
          brand: true,
          photoUrl: true,
          sizes: {
            select: { techSize: true, wbSize: true, barcode: true, chrtId: true },
          },
        },
      }),
      prisma.paidStorage.findMany({
        where: { wbAccountId, date: { gte: dfrom, lte: dto } },
        select: { nmId: true, chrtId: true, barcode: true, cost: true, date: true, fetchedAt: true },
      }),
      prisma.adCampaignNmStat.findMany({
        where: {
          date: { gte: dfrom, lte: dto },
          source: 'total',
          campaign: { wbAccountId },
        },
        select: { campaignId: true, nmId: true, spend: true },
      }),
      prisma.wbOrder.findMany({
        where: {
          wbAccountId,
          date: { gte: dfrom, lte: dto },
        },
        select: { nmId: true, date: true, finishedPrice: true },
      }),
      prisma.adCampaign.findMany({
        where: { wbAccountId },
        select: { id: true, advertId: true },
      }),
      getSyncCoverage(wbAccountId, SYNC_JOB_KINDS.REPORTS_PERIOD, dateFrom, dateTo),
    ])

  const costMap = new Map<string, number>()
  for (const cp of costPrices) {
    costMap.set(vendorCodeKey(cp.vendorCode), d(cp.costPrice))
  }

  const spMap = new Map<string, { quantity: number; amount: number; cashback: number }>()
  for (const sp of selfPurchases) {
    const key = vendorCodeKey(sp.vendorCode)
    const existing = spMap.get(key) ?? { quantity: 0, amount: 0, cashback: 0 }
    existing.quantity += sp.quantity
    existing.amount += d(sp.amount)
    existing.cashback += d(sp.cashback)
    spMap.set(key, existing)
  }

  const extAdMap = new Map<string, number>()
  for (const ad of externalAds) {
    if (ad.vendorCode) {
      const key = vendorCodeKey(ad.vendorCode)
      extAdMap.set(key, (extAdMap.get(key) ?? 0) + d(ad.amount))
    }
  }

  const overrideMap = new Map<string, { localName: string | null }>()
  for (const ov of overrides) {
    overrideMap.set(vendorCodeKey(ov.vendorCode), { localName: ov.localName })
  }

  const versionMap = buildArticleVersionMap(articleVersions.map((version) => ({
    id: version.id,
    nmId: version.nmId,
    dateFrom: version.dateFrom,
    dateTo: version.dateTo,
    vendorCode: version.vendorCode,
    costPrice: version.costPrice == null ? null : d(version.costPrice),
  })))

  const nmVendorMap = new Map<number, string>()
  const vendorNmMap = new Map<string, number>()
  const productMetaMap = new Map<number, { subjectName: string; brandName: string; photoUrl: string | null }>()
  const productSizesByNm = new Map<number, SizeMeta[]>()
  const sizeByBarcode = new Map<string, SizeMeta>()
  const sizeByChrtId = new Map<string, SizeMeta>()
  for (const p of products) {
    if (p.vendorCode) nmVendorMap.set(p.nmId, p.vendorCode)
    const key = vendorCodeKey(p.vendorCode)
    if (key && !vendorNmMap.has(key)) vendorNmMap.set(key, p.nmId)
    productMetaMap.set(p.nmId, {
      subjectName: p.category ?? '',
      brandName: p.brand ?? '',
      photoUrl: p.photoUrl ?? null,
    })
    const sizes = p.sizes.map((size) => {
      const label = sizeLabel(size.techSize, size.wbSize)
      return {
        key: size.barcode ? `barcode:${size.barcode}` : size.chrtId ? `chrt:${size.chrtId}` : `size:${label}`,
        label,
        techSize: size.techSize,
        wbSize: size.wbSize,
        barcode: size.barcode,
        chrtId: size.chrtId,
      }
    })
    productSizesByNm.set(p.nmId, sizes)
    for (const size of sizes) {
      if (size.barcode) sizeByBarcode.set(`${p.nmId}:${size.barcode}`, size)
      if (size.chrtId) sizeByChrtId.set(`${p.nmId}:${size.chrtId}`, size)
    }
  }

  const taxRate = d(account.taxRate)
  const adBalanceTotal = rows.reduce(
    (sum, row) => sum + (isWbPromotionDeduction(row) ? d(row.deduction) : 0),
    0,
  )
  const orderedRubByNm = new Map<number, number>()
  const orderedRubByGroup = new Map<string, number>()
  for (const order of orderRows) {
    orderedRubByNm.set(order.nmId, (orderedRubByNm.get(order.nmId) ?? 0) + d(order.finishedPrice))
    const key = reportGroupKey(order.nmId, resolveArticleVersion(versionMap, order.nmId, order.date))
    orderedRubByGroup.set(key, (orderedRubByGroup.get(key) ?? 0) + d(order.finishedPrice))
  }

  const paidStorageByNm = new Map<number, number>()
  const paidStorageByGroup = new Map<string, number>()
  const paidStorageGroups = new Map<string, { nmId: number; version: ArticleVersionMeta | null }>()
  const paidStorageBySize = new Map<string, number>()
  for (const ps of paidStorageRows) {
    if (ps.nmId === 0) continue
    paidStorageByNm.set(ps.nmId, (paidStorageByNm.get(ps.nmId) ?? 0) + d(ps.cost))
    const version = resolveArticleVersion(versionMap, ps.nmId, ps.date)
    const groupKey = reportGroupKey(ps.nmId, version)
    paidStorageGroups.set(groupKey, { nmId: ps.nmId, version })
    paidStorageByGroup.set(groupKey, (paidStorageByGroup.get(groupKey) ?? 0) + d(ps.cost))
    const size = resolveSizeMeta(ps.nmId, ps.barcode, ps.chrtId, sizeByBarcode, sizeByChrtId)
    if (size) {
      const key = `${groupKey}:${size.key}`
      paidStorageBySize.set(key, (paidStorageBySize.get(key) ?? 0) + d(ps.cost))
    }
  }

  const adSpendByNm = await buildAdSpendByNm({
    apiKey: account.apiKey,
    dateFrom,
    dateTo,
    adCampaigns,
    adNmStatRows,
    adBalanceTotal,
    preferLiveAdCostTotals: options.preferLiveAdCostTotals ?? false,
    preferPersistedAdStats: options.preferPersistedAdStats ?? true,
  })

  let globalStorageTotal = 0
  const outboundPerNm = new Map<number, number>()
  const outboundPerGroup = new Map<string, number>()
  let totalOutbound = 0

  for (const row of rows) {
    if (row.nmId === 0) {
      globalStorageTotal += d(row.storageFee)
    } else if (
      row.supplierOperName === OPERATION_LOGISTICS &&
      (row.bonusTypeName === BONUS_TO_CLIENT_SALE || row.bonusTypeName === BONUS_TO_CLIENT_CANCEL)
    ) {
      outboundPerNm.set(row.nmId, (outboundPerNm.get(row.nmId) ?? 0) + 1)
      const groupKey = reportGroupKey(row.nmId, resolveArticleVersion(versionMap, row.nmId, reportRowDate(row)))
      outboundPerGroup.set(groupKey, (outboundPerGroup.get(groupKey) ?? 0) + 1)
      totalOutbound++
    }
  }

  const usePaidStorage = paidStorageByNm.size > 0

  const grouped = new Map<string, { nmId: number; version: ArticleVersionMeta | null; rows: DbRow[] }>()
  for (const row of rows) {
    if (row.nmId === 0) continue
    const version = resolveArticleVersion(versionMap, row.nmId, reportRowDate(row))
    const key = reportGroupKey(row.nmId, version)
    const group = grouped.get(key) ?? { nmId: row.nmId, version, rows: [] }
    group.rows.push(row)
    grouped.set(key, group)
  }

  const hasRealizationRows = rows.some((row) => row.nmId !== 0)
  const reportGroups = new Map(grouped)
  if (hasRealizationRows) {
    for (const [key, group] of Array.from(paidStorageGroups.entries())) {
      if (!reportGroups.has(key)) reportGroups.set(key, { ...group, rows: [] })
    }
    for (const nmId of Array.from(adSpendByNm.keys())) {
      const version = resolveArticleVersion(versionMap, nmId, dto)
      const key = reportGroupKey(nmId, version)
      if (!reportGroups.has(key)) reportGroups.set(key, { nmId, version, rows: [] })
    }
    for (const vendorCode of Array.from(extAdMap.keys())) {
      const nmId = vendorNmMap.get(vendorCode)
      if (nmId) {
        const version = resolveArticleVersion(versionMap, nmId, dto)
        const key = reportGroupKey(nmId, version)
        if (!reportGroups.has(key)) reportGroups.set(key, { nmId, version, rows: [] })
      }
    }
    for (const vendorCode of Array.from(spMap.keys())) {
      const nmId = vendorNmMap.get(vendorCode)
      if (nmId) {
        const version = resolveArticleVersion(versionMap, nmId, dto)
        const key = reportGroupKey(nmId, version)
        if (!reportGroups.has(key)) reportGroups.set(key, { nmId, version, rows: [] })
      }
    }
  }

  const reportRows: ReportRow[] = []
  let totalOP = 0

  const saleBasisByNm = new Map<number, number>()
  for (const group of Array.from(reportGroups.values())) {
    const basis = groupBasis(group.rows)
    saleBasisByNm.set(group.nmId, (saleBasisByNm.get(group.nmId) ?? 0) + basis.sale)
  }

  for (const [groupKey, reportGroup] of Array.from(reportGroups.entries())) {
    const { nmId, version } = reportGroup
    const group = reportGroup.rows
    let extraStorage = 0

    if (usePaidStorage) {
      extraStorage = paidStorageByGroup.get(groupKey) ?? 0
    } else {
      const outbound = outboundPerGroup.get(groupKey) ?? outboundPerNm.get(nmId) ?? 0
      extraStorage = totalOutbound > 0 ? globalStorageTotal * (outbound / totalOutbound) : 0
    }

    const basis = groupBasis(group)
    const nmSaleBasis = saleBasisByNm.get(nmId) ?? 0
    const versionSaleShare = nmSaleBasis > 0 ? basis.sale / nmSaleBasis : 1

    const row = calculateGroup(
      nmId,
      group,
      costMap,
      spMap,
      extAdMap,
      overrideMap,
      taxRate,
      nmVendorMap,
      productMetaMap,
      extraStorage,
      usePaidStorage,
      (adSpendByNm.get(nmId)?.balance ?? 0) * versionSaleShare,
      (adSpendByNm.get(nmId)?.all ?? 0) * versionSaleShare,
      orderedRubByGroup.get(groupKey) ?? 0,
      version ? {
        displayVendorCode: version.vendorCode,
        versionCostPrice: version.costPrice,
      } : {},
    )

    const parentVendorCode = row.vendorCode
    const sizeGroups = groupRowsBySize(nmId, group, sizeByBarcode, sizeByChrtId)
    const shouldExposeSizes = sizeGroups.length > 1 || (productSizesByNm.get(nmId)?.length ?? 0) > 1
    if (shouldExposeSizes && sizeGroups.length > 0) {
      const referenceTotals = calculateReferenceTotals(row)
      const childBases = sizeGroups.map((sizeGroup) => groupBasis(sizeGroup.rows))
      const totalSaleBasis = childBases.reduce((sum, basis) => sum + basis.sale, 0)
      const totalQtyBasis = childBases.reduce((sum, basis) => sum + basis.boughtWithReturns, 0)
      const totalDeliveredBasis = childBases.reduce((sum, basis) => sum + basis.delivered, 0)
      const actualStorageTotal = sizeGroups.reduce(
        (sum, sizeGroup) => sum + (paidStorageBySize.get(`${nmId}:${sizeGroup.size.key}`) ?? 0),
        0,
      )
      const undistributedStorage = Math.max(0, extraStorage - actualStorageTotal)

      row.sizeRows = sizeGroups.map((sizeGroup, index) => {
        const basis = childBases[index]
        const saleShare = shareOf(basis.sale, totalSaleBasis, sizeGroups.length, index)
        const qtyShare = shareOf(basis.boughtWithReturns, totalQtyBasis, sizeGroups.length, index)
        const deliveredShare = shareOf(basis.delivered, totalDeliveredBasis, sizeGroups.length, index)
        const actualStorage = paidStorageBySize.get(`${groupKey}:${sizeGroup.size.key}`)
        const childStorage = (actualStorage ?? 0) + undistributedStorage * deliveredShare
        const childVendorCode = formatSizedVendorCode(parentVendorCode, sizeGroup.size.label)

        return calculateGroup(
          nmId,
          sizeGroup.rows,
          costMap,
          new Map(),
          new Map(),
          overrideMap,
          taxRate,
          nmVendorMap,
          productMetaMap,
          childStorage,
          usePaidStorage,
          (adSpendByNm.get(nmId)?.balance ?? 0) * saleShare,
          (adSpendByNm.get(nmId)?.all ?? 0) * saleShare,
          (orderedRubByNm.get(nmId) ?? 0) * saleShare,
          {
            sizeLabel: sizeGroup.size.label,
            isSizeRow: true,
            parentNmId: nmId,
            parentVendorCode,
            displayVendorCode: childVendorCode,
            versionCostPrice: version?.costPrice ?? null,
          },
          {
            externalAd: referenceTotals.externalAd * saleShare,
            selfPurchaseCost: referenceTotals.selfPurchaseCost * qtyShare,
            selfPurchaseAmount: referenceTotals.selfPurchaseAmount * qtyShare,
            selfPurchaseCashback: referenceTotals.selfPurchaseCashback * qtyShare,
          },
        )
      })
    }

    totalOP += Number(row.operatingProfit)
    reportRows.push(row)
  }

  for (const row of reportRows) {
    row.operatingProfitShare = safeDivide(Number(row.operatingProfit) * 100, totalOP, 2)
    for (const sizeRow of row.sizeRows ?? []) {
      sizeRow.operatingProfitShare = safeDivide(Number(sizeRow.operatingProfit) * 100, totalOP, 2)
    }
  }

  reportRows.sort((a, b) => Number(b.sale) - Number(a.sale))

  const summary = aggregateReportRows(reportRows, { subjectName: SUMMARY_LABEL })

  // Use WbAccount.lastSyncAt (updated by syncReportsAction) as the authoritative
  // sync time. createMany(skipDuplicates) doesn't update fetchedAt on existing rows,
  // so max(fetchedAt) would show a stale date on re-syncs.
  const lastSyncAt: string | null = account.lastSyncAt?.toISOString() ?? null

  return {
    rows: reportRows,
    summary,
    dateFrom,
    dateTo,
    lastSyncAt,
    coverage: {
      isCovered: coverage.isCovered,
      syncedAt: coverage.syncedAt,
    },
  }
}

function calculateGroup(
  nmId: number,
  group: DbRow[],
  costMap: Map<string, number>,
  spMap: Map<string, { quantity: number; amount: number; cashback: number }>,
  extAdMap: Map<string, number>,
  overrideMap: Map<string, { localName: string | null }>,
  taxRate: number,
  nmVendorMap: Map<number, string>,
  productMetaMap: Map<number, { subjectName: string; brandName: string; photoUrl: string | null }>,
  extraStorageFee = 0,
  skipRealizationStorage = false,
  adBalance = 0,
  adAll = adBalance,
  orderedRub = 0,
  identity: RowIdentity = {},
  referenceTotals?: ReferenceTotals,
): ReportRow {
  const vendorCodes = new Set<string>()
  const productMeta = nmId > 0 ? productMetaMap.get(nmId) : undefined
  let subjectName = productMeta?.subjectName ?? ''
  let brandName = productMeta?.brandName ?? ''
  const photoUrl = productMeta?.photoUrl ?? null

  let salesAmtWithSpp = 0
  let salesAmtNoSpp = 0
  let returnsAmtWithSpp = 0
  let returnsAmtNoSpp = 0
  let salesForPay = 0
  let returnsForPay = 0
  let salesCount = 0
  let returnsCount = 0
  let cancellationsCount = 0
  let totalDelivery = 0
  let totalPenalty = 0
  let totalAdditional = 0
  let totalStorage = 0
  let totalDeduction = 0
  let totalAcceptance = 0
  let commissionOnSale = 0
  let commissionOnReturn = 0
  let acquiringOnSale = 0
  let acquiringOnReturn = 0

  for (const row of group) {
    vendorCodes.add(row.vendorCode)
    if (!subjectName && row.subjectName) subjectName = row.subjectName
    if (!brandName && row.brandName) brandName = row.brandName

    const isSale = row.docTypeName === DOC_SALE
    const isReturn = row.docTypeName === DOC_RETURN
    const retailWithDisc = d(row.retailPriceWithDisc)
    const forPay = d(row.ppvzForPay)
    const delivery = d(row.deliveryRub)
    const penalty = d(row.penalty)
    const additional = d(row.additionalPayment)
    const storage = d(row.storageFee)
    const deduction = d(row.deduction)
    const acceptance = d(row.acceptance)
    const acquiring = d(row.acquiringFee)
    const commission = d(row.ppvzSalesCommission)

    if (isSale) {
      const sppFactor = 1 - d(row.ppvzSppPrc) / 100
      salesAmtWithSpp += retailWithDisc * sppFactor
      salesAmtNoSpp += retailWithDisc
      salesForPay += forPay
      salesCount += row.quantity
      commissionOnSale += commission
      acquiringOnSale += acquiring
    } else if (isReturn) {
      const sppFactor = 1 - d(row.ppvzSppPrc) / 100
      returnsAmtWithSpp += retailWithDisc * sppFactor
      returnsAmtNoSpp += retailWithDisc
      returnsForPay += forPay
      returnsCount += row.quantity
      commissionOnReturn += commission
      acquiringOnReturn += acquiring
    } else if (row.supplierOperName === OPERATION_LOGISTICS && row.bonusTypeName === BONUS_TO_CLIENT_CANCEL) {
      cancellationsCount++
    }

    totalDelivery += delivery
    totalPenalty += penalty
    totalAdditional += additional
    if (!skipRealizationStorage) totalStorage += storage
    totalDeduction += deduction
    totalAcceptance += acceptance
  }

  totalStorage += extraStorageFee

  const deliveredCount = salesCount + cancellationsCount

  const resolvedVendorCodes = new Map<string, string>()
  for (const vendorCode of Array.from(vendorCodes)) {
    const key = vendorCodeKey(vendorCode)
    if (key && !resolvedVendorCodes.has(key)) resolvedVendorCodes.set(key, vendorCode)
  }
  if (resolvedVendorCodes.size === 0 && nmId > 0) {
    const fallback = nmVendorMap.get(nmId)
    if (fallback) resolvedVendorCodes.set(vendorCodeKey(fallback), fallback)
  }

  const sale = salesAmtWithSpp - returnsAmtWithSpp
  const toTransfer = salesForPay - returnsForPay
  const boughtWithReturns = salesCount - returnsCount
  const boughtWithoutReturns = salesCount
  const avgPrice = salesCount > 0 && boughtWithReturns > 0 ? safeDivide(salesAmtWithSpp, salesCount) : '0.00'
  const buyoutPercent = safeDivideMinZero(boughtWithReturns * 100, deliveredCount)
  const totalCommission = commissionOnSale - commissionOnReturn
  const totalAcquiring = acquiringOnSale - acquiringOnReturn

  let costPriceTotal = 0
  let spTotalAmount = referenceTotals?.selfPurchaseAmount ?? 0
  let spTotalCashback = referenceTotals?.selfPurchaseCashback ?? 0
  let extAdTotal = referenceTotals?.externalAd ?? 0

  const vcArray = resolvedVendorCodes.size > 0
    ? Array.from(resolvedVendorCodes.values())
    : Array.from(vendorCodes)
  for (const vendorCode of vcArray) {
    const key = vendorCodeKey(vendorCode)
    const unitCost = identity.versionCostPrice ?? costMap.get(key) ?? 0
    costPriceTotal += unitCost * boughtWithReturns

    if (!referenceTotals) {
      const sp = spMap.get(key)
      if (sp) {
        spTotalAmount += sp.amount
        spTotalCashback += sp.cashback
      }

      extAdTotal += extAdMap.get(key) ?? 0
    }
  }

  let selfPurchaseCost = referenceTotals?.selfPurchaseCost ?? 0
  if (!referenceTotals) {
    for (const vendorCode of vcArray) {
      const key = vendorCodeKey(vendorCode)
      const sp = spMap.get(key)
      const unitCost = identity.versionCostPrice ?? costMap.get(key) ?? 0
      if (sp) selfPurchaseCost += sp.quantity * unitCost
    }
  }

  const taxes = Math.max(0, sale * (taxRate / 100))
  const totalAdAll = adAll + extAdTotal

  const operatingProfit =
    toTransfer
    - adAll
    - extAdTotal
    - totalDelivery
    - costPriceTotal
    - totalStorage
    - totalAcceptance
    - totalAdditional
    - totalPenalty
    - taxes
    - totalDeduction
    - spTotalAmount
    - spTotalCashback

  const totalToPay =
    toTransfer
    - adBalance
    - totalDelivery
    - totalAdditional
    - totalPenalty
    - totalStorage
    - totalAcceptance
    - totalDeduction

  const operatingProfitUnit = safeDivide(operatingProfit, boughtWithReturns)
  const marginality = safeMarginality(operatingProfit, sale)
  const rentability = safeDivide(operatingProfit * 100, costPriceTotal)
  const drr = safeDivide(totalAdAll * 100, sale)
  const romi = safeDivide((operatingProfit + totalAdAll) * 100, totalAdAll)
  const logisticsUnit = safeDivide(totalDelivery, boughtWithReturns)
  const logisticsFromSalesPercent = safeDivideMinZero(totalDelivery * 100, sale)
  const storageFromSalesPercent = safeDivideMinZero(totalStorage * 100, sale)

  const primaryVendorCode = (resolvedVendorCodes.size > 0 ? resolvedVendorCodes : vendorCodes)
    .values()
    .next()
    .value ?? ''
  const override = overrideMap.get(vendorCodeKey(primaryVendorCode))
  const displayVendorCode = identity.displayVendorCode ?? override?.localName ?? primaryVendorCode

  return {
    nmId,
    subjectName,
    vendorCode: displayVendorCode,
    brandName,
    photoUrl,
    sizeLabel: identity.sizeLabel ?? null,
    isSizeRow: identity.isSizeRow ?? false,
    parentNmId: identity.parentNmId ?? null,
    parentVendorCode: identity.parentVendorCode ?? null,

    orderedRub: fmt(orderedRub),
    sale: fmt(sale),
    toTransfer: fmt(toTransfer),
    totalToPay: fmt(totalToPay),
    operatingProfit: fmt(operatingProfit),
    operatingProfitUnit,
    operatingProfitShare: '0.00',
    avgPrice,

    boughtWithReturns,
    buyoutPercent,
    boughtWithoutReturns,
    returns: returnsCount,

    marginality,
    rentability,

    adBalance: fmt(adBalance),
    adAll: fmt(totalAdAll),
    drr,
    romi,

    logistics: fmt(totalDelivery),
    logisticsUnit,
    delivered: deliveredCount,
    logisticsFromSalesPercent,

    externalAd: fmt(extAdTotal),
    selfPurchaseCost: fmt(selfPurchaseCost),
    cashbackDistributions: fmt(spTotalCashback),
    selfPurchaseAmount: fmt(spTotalAmount),

    storageFromSalesPercent,
    costPrice: fmt(costPriceTotal),
    storageFee: fmt(totalStorage),
    acceptance: fmt(totalAcceptance),
    additionalPayment: fmt(totalAdditional),
    penalty: fmt(totalPenalty),
    taxes: fmt(taxes),
    commission: fmt(totalCommission),
    selfPurchases: fmt(spTotalAmount + spTotalCashback),
    acquiringFee: fmt(totalAcquiring),

    cancellations: cancellationsCount,

    salesReturnsNoSpp: fmt(salesAmtNoSpp - returnsAmtNoSpp),
    salesWithSpp: fmt(salesAmtWithSpp),
    returnsWithSpp: fmt(returnsAmtWithSpp),
    salesNoSpp: fmt(salesAmtNoSpp),
    returnsNoSpp: fmt(returnsAmtNoSpp),
    commissionOnSale: fmt(commissionOnSale),
    commissionOnReturn: fmt(commissionOnReturn),
    deductions: fmt(totalDeduction),
    salesToTransfer: fmt(salesForPay),
    returnsToTransfer: fmt(returnsForPay),
    acquiringOnSale: fmt(acquiringOnSale),
    tags: '',
    acquiringOnReturn: fmt(acquiringOnReturn),
  }
}

function sizeLabel(techSize: string | null | undefined, wbSize: string | null | undefined): string {
  const wb = (wbSize ?? '').trim()
  const tech = (techSize ?? '').trim()
  return tech || wb || 'без размера'
}

function resolveSizeMeta(
  nmId: number,
  barcode: string | null | undefined,
  chrtId: number | null | undefined,
  sizeByBarcode: Map<string, SizeMeta>,
  sizeByChrtId: Map<string, SizeMeta>,
): SizeMeta | null {
  if (barcode) {
    const byBarcode = sizeByBarcode.get(`${nmId}:${barcode}`)
    if (byBarcode) return byBarcode
  }
  if (chrtId) {
    const byChrtId = sizeByChrtId.get(`${nmId}:${chrtId}`)
    if (byChrtId) return byChrtId
  }
  if (barcode) {
    return {
      key: `barcode:${barcode}`,
      label: barcode,
      techSize: barcode,
      wbSize: null,
      barcode,
      chrtId: null,
    }
  }
  return null
}

function groupRowsBySize(
  nmId: number,
  rows: DbRow[],
  sizeByBarcode: Map<string, SizeMeta>,
  sizeByChrtId: Map<string, SizeMeta>,
): Array<{ size: SizeMeta; rows: DbRow[] }> {
  const grouped = new Map<string, { size: SizeMeta; rows: DbRow[] }>()

  for (const row of rows) {
    const size = resolveSizeMeta(nmId, row.barcode, null, sizeByBarcode, sizeByChrtId)
    if (!size) continue

    const existing = grouped.get(size.key) ?? { size, rows: [] }
    existing.rows.push(row)
    grouped.set(size.key, existing)
  }

  return Array.from(grouped.values()).sort((left, right) =>
    left.size.label.localeCompare(right.size.label, 'ru', { numeric: true }),
  )
}

function groupBasis(rows: DbRow[]): { sale: number; boughtWithReturns: number; delivered: number } {
  let sale = 0
  let salesCount = 0
  let returnsCount = 0
  let cancellationsCount = 0

  for (const row of rows) {
    const isSale = row.docTypeName === DOC_SALE
    const isReturn = row.docTypeName === DOC_RETURN
    if (isSale || isReturn) {
      const retailWithDisc = d(row.retailPriceWithDisc)
      const sppFactor = 1 - d(row.ppvzSppPrc) / 100
      const signed = retailWithDisc * sppFactor
      sale += isSale ? signed : -signed
      if (isSale) salesCount += row.quantity
      else returnsCount += row.quantity
    } else if (row.supplierOperName === OPERATION_LOGISTICS && row.bonusTypeName === BONUS_TO_CLIENT_CANCEL) {
      cancellationsCount++
    }
  }

  return {
    sale: Math.max(0, sale),
    boughtWithReturns: Math.max(0, salesCount - returnsCount),
    delivered: Math.max(0, salesCount + cancellationsCount),
  }
}

function shareOf(value: number, total: number, count: number, index: number): number {
  if (total > 0) return value / total
  return count > 0 ? 1 / count : index === 0 ? 1 : 0
}

function formatSizedVendorCode(vendorCode: string, label: string): string {
  const base = vendorCode.trim()
  const suffix = label.trim()
  if (!suffix) return base
  return base ? `${base} ${suffix}` : suffix
}

function calculateReferenceTotals(row: ReportRow): ReferenceTotals {
  return {
    externalAd: Number(row.externalAd),
    selfPurchaseCost: Number(row.selfPurchaseCost),
    selfPurchaseAmount: Number(row.selfPurchaseAmount),
    selfPurchaseCashback: Number(row.cashbackDistributions),
  }
}

async function findArticleVersionsForReport(
  wbAccountId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<ArticleVersionMeta[]> {
  const delegate = (prisma as unknown as {
    articleVersion?: {
      findMany(args: unknown): Promise<Array<{
        id: string
        nmId: number
        dateFrom: Date
        dateTo: Date | null
        vendorCode: string
        costPrice: { toString(): string } | number | string | null
      }>>
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
    : await prisma.$queryRaw<Array<{
      id: string
      nmId: number
      dateFrom: Date
      dateTo: Date | null
      vendorCode: string
      costPrice: { toString(): string } | number | string | null
    }>>`
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

function buildArticleVersionMap(versions: ArticleVersionMeta[]): Map<number, ArticleVersionMeta[]> {
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

function resolveArticleVersion(
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

function reportGroupKey(nmId: number, version: ArticleVersionMeta | null): string {
  return version ? `${nmId}:version:${version.id}` : `${nmId}:base`
}

function reportRowDate(row: DbRow): Date {
  return row.rrDt ?? row.saleDt ?? row.orderDt ?? row.dateFrom
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

interface AdSpendByNm {
  balance: number
  all: number
}

interface CampaignRef {
  id: string
  advertId: number
}

function addAdSpend(target: Map<number, AdSpendByNm>, nmId: number, balance: number, all: number) {
  if (nmId === 0) return
  const existing = target.get(nmId) ?? { balance: 0, all: 0 }
  existing.balance += balance
  existing.all += all
  target.set(nmId, existing)
}

function metricSpend(point: WbFullStatsMetricPoint): number {
  return d(point.sum ?? point.spend ?? point.sum_price)
}

function dayApps(day: WbFullStatsDayItem): WbFullStatsAppType[] {
  return day.apps ?? day.app_type_stats ?? day.appTypeStats ?? []
}

function campaignDays(campaign: WbFullStatsCampaign): WbFullStatsDayItem[] {
  return campaign.days ?? campaign.daily_stats ?? []
}

function getAdvertId(value: WbFullStatsCampaign | WbUpdHistoryItem): number {
  return Number(value.advertId ?? value.advert_id ?? 0)
}

function getUpdSum(value: WbUpdHistoryItem): number {
  return d(value.updSum ?? value.upd_sum ?? value.sum)
}

function isWbPromotionDeduction(row: DbRow): boolean {
  return row.supplierOperName === OPERATION_DEDUCTION
    && (row.bonusTypeName ?? '').includes(WB_PROMOTION_SERVICE)
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function buildDateChunks(dateFrom: string, dateTo: string, maxDays: number): Array<{ dateFrom: string; dateTo: string }> {
  const chunks: Array<{ dateFrom: string; dateTo: string }> = []
  const end = parseDate(dateTo)
  let current = parseDate(dateFrom)

  while (current <= end) {
    const chunkEnd = addDays(current, maxDays - 1)
    const boundedEnd = chunkEnd < end ? chunkEnd : end
    chunks.push({
      dateFrom: formatDate(current),
      dateTo: formatDate(boundedEnd),
    })
    current = addDays(boundedEnd, 1)
  }

  return chunks
}

async function fetchUpdHistoryByChunks(
  client: WbApiClient,
  dateFrom: string,
  dateTo: string,
): Promise<WbUpdHistoryItem[]> {
  const result: WbUpdHistoryItem[] = []

  for (const chunk of buildDateChunks(dateFrom, dateTo, MAX_UPD_HISTORY_DAYS)) {
    result.push(...await fetchUpdHistory(client, chunk.dateFrom, chunk.dateTo))
  }

  return result
}

async function fetchFullStatsByChunks(
  client: WbApiClient,
  advertIds: number[],
  dateFrom: string,
  dateTo: string,
): Promise<WbFullStatsCampaign[]> {
  const result: WbFullStatsCampaign[] = []

  for (const chunk of buildDateChunks(dateFrom, dateTo, MAX_UPD_HISTORY_DAYS)) {
    result.push(...((await fetchFullStats(client, advertIds, chunk.dateFrom, chunk.dateTo)) ?? []))
  }

  return result
}

function buildNmSpendWeights(campaigns: WbFullStatsCampaign[]): Map<number, Map<number, number>> {
  const result = new Map<number, Map<number, number>>()

  for (const campaign of campaigns) {
    const advertId = getAdvertId(campaign)
    if (!advertId) continue

    const byNm = result.get(advertId) ?? new Map<number, number>()
    for (const day of campaignDays(campaign)) {
      for (const app of dayApps(day)) {
        for (const point of app.nms ?? []) {
          const nmId = point.nmId ?? point.nm_id ?? 0
          if (!nmId) continue
          byNm.set(nmId, (byNm.get(nmId) ?? 0) + metricSpend(point))
        }
      }
      for (const point of day.nms ?? []) {
        const nmId = point.nmId ?? point.nm_id ?? 0
        if (!nmId) continue
        byNm.set(nmId, (byNm.get(nmId) ?? 0) + metricSpend(point))
      }
    }

    result.set(advertId, byNm)
  }

  return result
}

function buildPersistedNmSpendWeights(
  adCampaigns: CampaignRef[],
  adNmStatRows: AdNmStatRow[],
): Map<number, Map<number, number>> {
  const idToAdvertId = new Map(adCampaigns.map((campaign) => [campaign.id, campaign.advertId]))
  const result = new Map<number, Map<number, number>>()

  for (const row of adNmStatRows) {
    const advertId = idToAdvertId.get(row.campaignId)
    if (!advertId || row.nmId === 0) continue
    const byNm = result.get(advertId) ?? new Map<number, number>()
    byNm.set(row.nmId, (byNm.get(row.nmId) ?? 0) + d(row.spend))
    result.set(advertId, byNm)
  }

  return result
}

async function buildCampaignSettingsWeights(
  client: WbApiClient,
  advertIds: number[],
): Promise<Map<number, Map<number, number>>> {
  const result = new Map<number, Map<number, number>>()
  const campaigns = await fetchAdvertInfoByIds(client, advertIds)

  for (const campaign of campaigns) {
    const nmIds = Array.from(new Set((campaign.nm_settings ?? []).map((item) => item.nm_id).filter(Boolean)))
    if (nmIds.length === 0) continue

    const byNm = new Map<number, number>()
    for (const nmId of nmIds) {
      byNm.set(nmId, 1)
    }
    result.set(campaign.id, byNm)
  }

  return result
}

function distributeCampaignSpend(
  target: Map<number, AdSpendByNm>,
  nmWeights: Map<number, number> | undefined,
  balanceAmount: number,
  allAmount: number,
  forceProportional = false,
) {
  if (!nmWeights || nmWeights.size === 0) return

  const positiveWeights = Array.from(nmWeights.entries()).filter(([, value]) => value > 0)
  if (positiveWeights.length === 0) return

  const totalWeight = positiveWeights.reduce((sum, [, value]) => sum + value, 0)
  const [dominantNmId, dominantWeight] = positiveWeights.reduce(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    positiveWeights[0],
  )

  if (!forceProportional && dominantWeight / totalWeight >= DOMINANT_CAMPAIGN_NM_SHARE) {
    addAdSpend(target, dominantNmId, balanceAmount, allAmount)
    return
  }

  for (const [nmId, weight] of positiveWeights) {
    const share = weight / totalWeight
    addAdSpend(target, nmId, balanceAmount * share, allAmount * share)
  }
}

function fallbackAdSpendByNm(adNmStatRows: AdNmStatRow[]): Map<number, AdSpendByNm> {
  const result = new Map<number, AdSpendByNm>()
  for (const row of adNmStatRows) {
    addAdSpend(result, row.nmId, d(row.spend), d(row.spend))
  }
  return result
}

function applyAdBalanceTotalByAll(
  target: Map<number, AdSpendByNm>,
  adBalanceTotal: number,
): Map<number, AdSpendByNm> {
  const entries = Array.from(target.entries()).filter(([, spend]) => spend.all > 0)
  const totalAll = entries.reduce((sum, [, spend]) => sum + spend.all, 0)

  if (totalAll <= 0) {
    for (const spend of Array.from(target.values())) spend.balance = 0
    return target
  }

  const scale = Number.isInteger(adBalanceTotal) ? 1 : 100
  const totalUnits = Math.round(adBalanceTotal * scale)
  const allocations = entries
    .map(([nmId, spend]) => {
      const rawUnits = (totalUnits * spend.all) / totalAll
      const units = Math.floor(rawUnits)
      return {
        nmId,
        units,
        fraction: rawUnits - units,
      }
    })
    .sort((left, right) => right.fraction - left.fraction || left.nmId - right.nmId)

  let allocatedUnits = allocations.reduce((sum, item) => sum + item.units, 0)
  for (const item of allocations) {
    if (allocatedUnits >= totalUnits) break
    item.units++
    allocatedUnits++
  }

  const byNm = new Map(allocations.map((item) => [item.nmId, item.units / scale]))
  for (const [nmId, spend] of Array.from(target.entries())) {
    spend.balance = byNm.get(nmId) ?? 0
  }

  return target
}

function hasPositiveNmWeights(nmWeights: Map<number, number> | undefined): boolean {
  if (!nmWeights) return false
  return Array.from(nmWeights.values()).some((value) => value > 0)
}

function applyAdvertNmAllocationOverrides(weights: Map<number, Map<number, number>>) {
  for (const [advertId, allocations] of Array.from(ADVERT_NM_ALLOCATION_OVERRIDES.entries())) {
    weights.set(advertId, new Map(allocations))
  }
}

async function buildAdSpendByNm(params: {
  apiKey: string
  dateFrom: string
  dateTo: string
  adCampaigns: CampaignRef[]
  adNmStatRows: AdNmStatRow[]
  adBalanceTotal: number
  preferLiveAdCostTotals?: boolean
  preferPersistedAdStats?: boolean
}): Promise<Map<number, AdSpendByNm>> {
  const fallback = fallbackAdSpendByNm(params.adNmStatRows)

  if (params.preferPersistedAdStats && !params.preferLiveAdCostTotals) {
    return applyAdBalanceTotalByAll(fallback, params.adBalanceTotal)
  }

  try {
    const client = new WbApiClient(decrypt(params.apiKey))
    const costs = await fetchUpdHistoryByChunks(client, params.dateFrom, params.dateTo)
    const advertIds = Array.from(new Set(costs.map(getAdvertId).filter(Boolean)))
    if (advertIds.length === 0) return applyAdBalanceTotalByAll(fallback, params.adBalanceTotal)

    const weights = buildPersistedNmSpendWeights(params.adCampaigns, params.adNmStatRows)
    applyAdvertNmAllocationOverrides(weights)
    const missingWeightAdvertIds = advertIds.filter((advertId) => !hasPositiveNmWeights(weights.get(advertId)))
    if (!params.preferLiveAdCostTotals && missingWeightAdvertIds.length > 0) {
      try {
        const liveWeights = buildNmSpendWeights(
          await fetchFullStatsByChunks(client, missingWeightAdvertIds, params.dateFrom, params.dateTo),
        )
        for (const [advertId, nmWeights] of Array.from(liveWeights.entries())) {
          weights.set(advertId, nmWeights)
        }
      } catch {
        // Persisted stats remain the fallback weight source below.
      }
    }

    const stillMissingWeightAdvertIds = advertIds.filter((advertId) => !hasPositiveNmWeights(weights.get(advertId)))
    if (stillMissingWeightAdvertIds.length > 0) {
      try {
        const settingsWeights = await buildCampaignSettingsWeights(client, stillMissingWeightAdvertIds)
        for (const [advertId, nmWeights] of Array.from(settingsWeights.entries())) {
          weights.set(advertId, nmWeights)
        }
      } catch {
        // If campaign settings are unavailable too, that campaign cannot be safely distributed.
      }
    }

    const result = new Map<number, AdSpendByNm>()
    const costsByAdvertId = new Map<number, { all: number }>()
    for (const cost of costs) {
      const advertId = getAdvertId(cost)
      const allAmount = getUpdSum(cost)
      if (!advertId || allAmount === 0) continue

      const existing = costsByAdvertId.get(advertId) ?? { all: 0 }
      existing.all += allAmount
      costsByAdvertId.set(advertId, existing)
    }

    for (const [advertId, cost] of Array.from(costsByAdvertId.entries())) {
      distributeCampaignSpend(
        result,
        weights.get(advertId),
        0,
        cost.all,
        PROPORTIONAL_ADVERT_ALLOCATION_OVERRIDES.has(advertId),
      )
    }

    return applyAdBalanceTotalByAll(result.size > 0 ? result : fallback, params.adBalanceTotal)
  } catch {
    return applyAdBalanceTotalByAll(fallback, params.adBalanceTotal)
  }
}

function d(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

// Finance API may lowercase vendor codes while reference tables preserve card casing.
function vendorCodeKey(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('ru-RU')
}

function fmt(value: number): string {
  return value.toFixed(2)
}

function safeDivide(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return (0).toFixed(decimals)
  return (numerator / denominator).toFixed(decimals)
}

function safeDivideMinZero(numerator: number, denominator: number, decimals = 2): string {
  if (denominator === 0) return (0).toFixed(decimals)
  return Math.max(0, numerator / denominator).toFixed(decimals)
}

function safeMarginality(operatingProfit: number, sale: number, decimals = 2): string {
  if (operatingProfit < 0 && sale < 0) return (0).toFixed(decimals)
  return safeDivide(operatingProfit * 100, sale, decimals)
}
