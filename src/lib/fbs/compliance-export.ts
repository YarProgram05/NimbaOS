export const KIZ_COMPLIANCE_EXPORTS = {
  WITHDRAWAL: {
    taskTypes: ['WITHDRAWAL_REMOTE_SALE', 'WITHDRAWAL_B2B'],
    filenamePrefix: 'kiz_withdrawal',
    sheetName: 'Коды на вывод',
    emptyMessage: 'Нет КИЗов, ожидающих вывода из оборота',
    includeUnitPrice: true,
  },
  RETURN_TO_CIRCULATION: {
    taskTypes: ['RETURN_TO_CIRCULATION'],
    filenamePrefix: 'kiz_return_to_circulation',
    sheetName: 'Коды на возврат',
    emptyMessage: 'Нет КИЗов, ожидающих возврата в оборот',
    includeUnitPrice: false,
  },
} as const

export type KizComplianceExportKind = keyof typeof KIZ_COMPLIANCE_EXPORTS

export function getKizComplianceExportDefinition(value: unknown) {
  if (typeof value !== 'string' || !(value in KIZ_COMPLIANCE_EXPORTS)) {
    throw new Error('Неизвестный вид выгрузки КИЗов')
  }
  return KIZ_COMPLIANCE_EXPORTS[value as KizComplianceExportKind]
}

export function toCrptUnitPriceRub(convertedPriceRaw: number | null | undefined) {
  if (!Number.isInteger(convertedPriceRaw) || (convertedPriceRaw ?? 0) <= 0) {
    throw new Error('У заказа отсутствует корректная цена для выгрузки в Честный знак')
  }
  return (convertedPriceRaw as number) / 100
}
