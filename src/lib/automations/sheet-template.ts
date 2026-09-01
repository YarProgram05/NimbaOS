import type { AutomationSheetRoleDefinition } from '@/types/automations'

export const FBS_SHEET_ROLES = {
  OPERATIONS: 'operations',
  CONTROL: 'control',
  SUMMARY: 'summary',
  REFERENCE: 'reference',
  WB_STOCK: 'wb-stock',
} as const

export const FBS_SHEET_ROLE_DEFINITIONS: AutomationSheetRoleDefinition[] = [
  {
    role: FBS_SHEET_ROLES.OPERATIONS,
    title: 'Операции заказов',
    description: 'Заказы, отмены до отгрузки и принятые возвраты.',
    required: true,
    defaultSheetName: 'Операции',
  },
  {
    role: FBS_SHEET_ROLES.CONTROL,
    title: 'Контроль загрузки',
    description: 'Итог и статус обработки каждого дня по кабинетам.',
    required: true,
    defaultSheetName: 'Контроль загрузки',
  },
  {
    role: FBS_SHEET_ROLES.SUMMARY,
    title: 'Итоговая сводка',
    description: 'Формулы, остатки и общий результат таблицы учета.',
    required: true,
    defaultSheetName: 'Сводка',
  },
  {
    role: FBS_SHEET_ROLES.REFERENCE,
    title: 'Справочник товаров',
    description: 'Канонические названия товаров и служебные параметры.',
    required: true,
    defaultSheetName: 'Справочники',
  },
  {
    role: FBS_SHEET_ROLES.WB_STOCK,
    title: 'Остатки WB',
    description: 'Текущий снимок остатков Wildberries по кабинетам.',
    required: true,
    defaultSheetName: 'Остатки WB',
  },
]

export const FBS_DEFAULT_SHEET_TABS = Object.fromEntries(
  FBS_SHEET_ROLE_DEFINITIONS.map((definition) => [definition.role, definition.defaultSheetName]),
) as Record<string, string>

const FBS_LEGACY_TAB_FIELDS: Record<string, string> = {
  [FBS_SHEET_ROLES.OPERATIONS]: 'operationsSheetName',
  [FBS_SHEET_ROLES.CONTROL]: 'controlSheetName',
  [FBS_SHEET_ROLES.SUMMARY]: 'summarySheetName',
  [FBS_SHEET_ROLES.REFERENCE]: 'referenceSheetName',
  [FBS_SHEET_ROLES.WB_STOCK]: 'wbStockSheetName',
}

export function normalizeSheetTabs(
  value: unknown,
  defaults: Record<string, string> = {},
): Record<string, string> {
  const configured = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
      Object.entries(value)
        .filter(([, sheetName]) => typeof sheetName === 'string' && sheetName.trim())
        .map(([role, sheetName]) => [role, String(sheetName).trim()]),
    )
    : {}
  return { ...defaults, ...configured }
}

export function normalizeFbsSheetTabs(
  value: unknown,
  options: { withDefaults?: boolean } = {},
): Record<string, string> {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const explicitTabs = raw.sheetTabs && typeof raw.sheetTabs === 'object' && !Array.isArray(raw.sheetTabs)
    ? raw.sheetTabs as Record<string, unknown>
    : {}
  const result = normalizeSheetTabs(
    explicitTabs,
    options.withDefaults === false ? {} : FBS_DEFAULT_SHEET_TABS,
  )
  for (const [role, legacyField] of Object.entries(FBS_LEGACY_TAB_FIELDS)) {
    const hasExplicitValue = typeof explicitTabs[role] === 'string' && explicitTabs[role].trim()
    const legacyValue = raw[legacyField]
    if (!hasExplicitValue && typeof legacyValue === 'string' && legacyValue.trim()) {
      result[role] = legacyValue.trim()
    }
  }
  return result
}

export function validateSheetTabs(
  sheetTabs: Record<string, string>,
  definitions: AutomationSheetRoleDefinition[],
): Record<string, string> {
  const normalized = normalizeSheetTabs(sheetTabs)
  const used = new Map<string, string>()
  for (const definition of definitions) {
    const sheetName = normalized[definition.role]?.trim() ?? ''
    if (definition.required && !sheetName) {
      throw new Error(`Выберите вкладку для назначения «${definition.title}»`)
    }
    if (!sheetName) continue
    const duplicateRole = used.get(sheetName.toLocaleLowerCase('ru'))
    if (duplicateRole) {
      throw new Error(`Вкладка «${sheetName}» назначена нескольким ролям`)
    }
    used.set(sheetName.toLocaleLowerCase('ru'), definition.role)
    normalized[definition.role] = sheetName
  }
  return normalized
}

export function getRequiredSheetTab(
  config: { sheetTabs: Record<string, string> },
  role: string,
): string {
  const sheetName = config.sheetTabs[role]?.trim()
  if (!sheetName) throw new Error(`Не настроена вкладка для роли ${role}`)
  return sheetName
}
