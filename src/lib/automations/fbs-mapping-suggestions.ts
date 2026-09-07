export interface FbsConfirmedProductExample {
  productName: string
  vendorCode: string | null
  techSize?: string | null
  wbSize?: string | null
}

export interface FbsProductGroupSuggestion {
  productName: string
  matchedVendorCode: string
  score: number
  reason: string
}

const COLORS = new Set(['бел', 'черн', 'желт', 'зелен', 'голуб', 'син', 'розов', 'оранж', 'малин', 'сирен', 'мят', 'коричн'])
const STOP_WORDS = new Set(['туника', 'парео', 'с', 'со', 'без', 'и', 'для', 'на'])

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
    .replace(/светло(?=зелен|голуб|син|розов)/g, 'светло ')
    .replace(/[^a-zа-я0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function stem(token: string) {
  if (token === 'св' || token.startsWith('светл')) return 'светл'
  if (token === 'зел') return 'зелен'
  for (const prefix of [...Array.from(COLORS), 'леопард', 'пятн', 'развод', 'лист', 'зме', 'волн', 'квадрат']) {
    if (token.startsWith(prefix)) return prefix
  }
  return token
}

function profile(value: string) {
  const normalized = normalize(value)
  const words = normalized.split(' ')
  const hasBelt = words.some((word) => word.startsWith('пояс'))
  const explicitlyWithoutBelt = /без пояс/.test(normalized)
  const belt = hasBelt && !explicitlyWithoutBelt
  const tokens = new Set(words.filter((word) => word && !STOP_WORDS.has(word)
    && !word.startsWith('пояс') && !/^\d+$/.test(word)).map(stem))
  const colors = new Set(Array.from(tokens).filter((token) => COLORS.has(token)))
  const motifs = new Set(Array.from(tokens).filter((token) => !COLORS.has(token) && token !== 'светл'))
  return { belt, explicitlyWithoutBelt, tokens, colors, motifs }
}

function meaningfulSize(value: string | null | undefined) {
  const size = (value ?? '').normalize('NFKC').toLowerCase().trim().replace(/[–—]/g, '-').replace(/\s+/g, '')
  // WB's internal tech sizes "0"/"1" and "единый" do not prove physical size.
  return /^(?:\d{2,3}(?:-\d{2,3})?|[2-5]?x{0,3}[sml])$/.test(size) ? size : null
}

function productSize(value: { techSize?: string | null; wbSize?: string | null }) {
  return meaningfulSize(value.wbSize) ?? meaningfulSize(value.techSize)
}

const intersect = (left: Set<string>, right: Set<string>) => Array.from(left).filter((value) => right.has(value))
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

// These are review candidates only. No suggestion establishes a physical identity,
// changes a tuple's confirmed mapping, or merges records for different sizes.
export function suggestFbsProductGroups(params: {
  vendorCode: string | null
  productTitle?: string | null
  techSize?: string | null
  wbSize?: string | null
  groups: string[]
  confirmedExamples?: FbsConfirmedProductExample[]
}): FbsProductGroupSuggestion[] {
  const query = profile(params.vendorCode?.trim() || params.productTitle?.trim() || '')
  if (!query.tokens.size) return []
  const querySize = productSize(params)
  const suggestions: FbsProductGroupSuggestion[] = []
  for (const productName of Array.from(new Set(params.groups.map((name) => name.trim()).filter(Boolean))).sort(compareText)) {
    const examples = (params.confirmedExamples ?? []).filter((example) => example.productName === productName && example.vendorCode?.trim())
    const evidence = examples.length ? examples : [{ productName, vendorCode: null }]
    let best: FbsProductGroupSuggestion | undefined
    for (const example of evidence) {
      const candidate = profile(example.vendorCode?.trim() || productName)
      // Canonical group names can retain the belt distinction when a seller's
      // abbreviated article omits it. Never infer a belt from a generic title.
      const candidateBelt = candidate.belt || profile(productName).belt
      if (query.belt && candidate.explicitlyWithoutBelt) continue
      if (query.belt !== candidateBelt) continue
      if (query.colors.size && candidate.colors.size && !intersect(query.colors, candidate.colors).length) continue
      if ((query.motifs.size || candidate.motifs.size) && !intersect(query.motifs, candidate.motifs).length) continue
      const matched = intersect(query.tokens, candidate.tokens)
      const overlap = 2 * matched.length / (query.tokens.size + candidate.tokens.size)
      if (overlap < 0.6) continue
      const candidateSize = productSize(example)
      if (querySize && candidateSize && querySize !== candidateSize) continue
      const exactMotif = query.tokens.size === candidate.tokens.size && matched.length === query.tokens.size
      const exactSize = Boolean(querySize && candidateSize === querySize)
      const score = Math.round(overlap * 60) + (exactMotif ? 25 : 0) + (exactSize ? 10 : 0) + (example.vendorCode ? 5 : 0)
      const matchedVendorCode = example.vendorCode?.trim() || ''
      const reason = `${matchedVendorCode ? `Подтверждённый артикул продавца: «${matchedVendorCode}»` : `Название группы: «${productName}»`}; ${exactMotif ? 'совпадает описание' : `общие признаки: ${matched.sort(compareText).join(', ')}`}${exactSize ? `; размер ${querySize}` : ''}. Требуется подтверждение.`
      const suggestion = { productName, matchedVendorCode, score, reason }
      if (!best || score > best.score || (score === best.score && compareText(matchedVendorCode, best.matchedVendorCode) < 0)) best = suggestion
    }
    if (best) suggestions.push(best)
  }
  return suggestions.sort((left, right) => right.score - left.score || compareText(left.productName, right.productName)).slice(0, 3)
}
