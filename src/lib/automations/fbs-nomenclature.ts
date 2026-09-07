import {
  fbsProductTupleKey,
  validateFbsAccountTechnicalKey,
} from './fbs-sheet'

export interface FbsNomenclatureCandidate {
  accountKey: string
  nmId: number
  chrtId: number
  vendorCode?: string | null
  // A changed/additional barcode does not create a new physical size identity.
  barcode?: string | null
}

export interface FbsNomenclaturePlan {
  productNames: Map<string, string>
  newReferenceNames: string[]
}

export interface FbsUnmappedProduct {
  accountKey: string
  nmId: number
  chrtId: number
  vendorCode: string | null
  reason: 'unknown-tuple' | 'missing-reference'
}

export class FbsNomenclatureMappingError extends Error {
  readonly products: FbsUnmappedProduct[]

  constructor(products: FbsUnmappedProduct[]) {
    const details = products.map((product) => {
      const vendor = product.vendorCode ? ` (${product.vendorCode})` : ''
      const reason = product.reason === 'missing-reference' ? ': сохранённого товара нет в справочнике' : ''
      return `${product.accountKey}, nmId ${product.nmId}, chrtId ${product.chrtId}${vendor}${reason}`
    })
    super(`Нужно подтвердить складское название товара: ${details.join('; ')}`)
    this.name = 'FbsNomenclatureMappingError'
    this.products = products
  }
}

/** Plans owner-approved labels only; it never infers a physical product from a WB title. */
export function planFbsNomenclature(params: {
  candidates: FbsNomenclatureCandidate[]
  productNames: Map<string, string>
  productAliases?: Map<string, string>
  allowedProductNames: string[]
}): FbsNomenclaturePlan {
  const candidates = params.candidates.map((candidate) => {
    const accountKey = validateFbsAccountTechnicalKey(candidate.accountKey)
    if (!Number.isSafeInteger(candidate.nmId) || candidate.nmId <= 0 ||
      !Number.isSafeInteger(candidate.chrtId) || candidate.chrtId <= 0) {
      throw new Error(`Некорректный артикул или размер для ${accountKey}: ${candidate.nmId}:${candidate.chrtId}`)
    }
    return {
      ...candidate,
      accountKey,
      vendorCode: candidate.vendorCode?.trim() ?? '',
      tuple: fbsProductTupleKey(accountKey, candidate.nmId, candidate.chrtId),
    }
  }).sort((left, right) => (
    compareText(left.tuple, right.tuple) ||
    Number(!left.vendorCode) - Number(!right.vendorCode) ||
    compareText(left.vendorCode, right.vendorCode)
  ))

  const productNames = new Map(params.productNames)
  const referenceNames = new Set(params.allowedProductNames.map((name) => name.trim()).filter(Boolean))
  const newReferenceNames = new Set<string>()
  const unmapped: FbsUnmappedProduct[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate.tuple)) continue
    seen.add(candidate.tuple)
    const alias = params.productAliases?.get(candidate.tuple)?.trim()
    const known = productNames.get(candidate.tuple)?.trim()
    if (alias) {
      productNames.set(candidate.tuple, alias)
      if (!referenceNames.has(alias)) newReferenceNames.add(alias)
      continue
    }
    if (known && referenceNames.has(known)) continue
    unmapped.push({
      accountKey: candidate.accountKey,
      nmId: candidate.nmId,
      chrtId: candidate.chrtId,
      vendorCode: candidate.vendorCode || null,
      reason: known ? 'missing-reference' : 'unknown-tuple',
    })
  }
  if (unmapped.length) throw new FbsNomenclatureMappingError(unmapped)
  return { productNames, newReferenceNames: Array.from(newReferenceNames) }
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}
