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

export const KIZ_COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ожидает обработки',
  EXPORTED: 'Выгружено в файл',
  CONFIRMED: 'Подтверждено',
  CANCELED: 'Отменено',
}

export const FBS_ACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает выполнения',
  RUNNING: 'Выполняется',
  SUCCEEDED: 'Выполнено',
  FAILED: 'Ошибка',
}

export const FBS_ACTION_KIND_LABELS: Record<string, string> = {
  ATTACH_KIZ: 'Передача КИЗа в WB',
  SET_ORDER_STATUS: 'Изменение статуса заказа',
  MOVE_TO_SUPPLY: 'Перемещение заказа в поставку',
  CLOSE_SUPPLY: 'Закрытие поставки',
  PUBLISH_STOCKS: 'Публикация остатков',
}

export function getFbsSupplierStatusLabel(status: string): string {
  return FBS_SUPPLIER_STATUS_LABELS[status] ?? 'Неизвестный статус продавца'
}

export function getFbsWbStatusLabel(status: string): string {
  return FBS_WB_STATUS_LABELS[status] ?? 'Неизвестный статус WB'
}

export function getKizComplianceStatusLabel(status: string): string {
  return KIZ_COMPLIANCE_STATUS_LABELS[status] ?? 'Неизвестный статус операции'
}

export function getFbsActionStatusLabel(status: string): string {
  return FBS_ACTION_STATUS_LABELS[status] ?? 'Неизвестный статус действия'
}

export function getFbsActionKindLabel(kind: string): string {
  return FBS_ACTION_KIND_LABELS[kind] ?? 'Неизвестное действие с WB'
}
