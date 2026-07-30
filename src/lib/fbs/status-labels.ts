export const FBS_SUPPLIER_STATUS_LABELS: Record<string, string> = {
  new: 'Новое задание',
  confirm: 'На сборке',
  complete: 'В доставке',
  cancel: 'Отменено продавцом',
}

export const FBS_WB_STATUS_LABELS: Record<string, string> = {
  waiting: 'В работе',
  sorted: 'Отсортировано',
  sold: 'Получено покупателем',
  canceled: 'Отменено',
  canceled_by_client: 'Отменено покупателем при получении',
  declined_by_client: 'Отменено покупателем в первый час',
  defect: 'Отменено из-за брака',
  ready_for_pickup: 'Прибыло в ПВЗ',
  accepted_by_carrier: 'Передано перевозчику',
  sent_to_carrier: 'Отправлено на склад перевозчика',
}

export const FBS_STATUS_ACTION_LABELS = {
  confirm: 'На сборку',
  complete: 'В доставку',
  cancel: 'Отменить',
} as const

export function getFbsSupplierStatusLabel(status: string): string {
  return FBS_SUPPLIER_STATUS_LABELS[status] ?? 'Неизвестный статус продавца'
}

export function getFbsWbStatusLabel(status: string): string {
  return FBS_WB_STATUS_LABELS[status] ?? 'Неизвестный статус WB'
}
