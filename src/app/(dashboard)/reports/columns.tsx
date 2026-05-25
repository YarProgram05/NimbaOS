import type { ColumnDef, SortingFn } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReportRow, ColumnGroup, ColumnGroupId } from '@/types/reports'
import { WbArticleLink } from '@/components/wb-article-link'

/** Numeric sort for string-valued columns (monetary, percentage).
 *  Fixes ascending sort of negatives: "-200" must come before "-100". */
const numSort: SortingFn<ReportRow> = (rowA, rowB, colId) => {
  const a = parseFloat(String(rowA.getValue(colId) ?? '0'))
  const b = parseFloat(String(rowB.getValue(colId) ?? '0'))
  if (isNaN(a) && isNaN(b)) return 0
  if (isNaN(a)) return 1
  if (isNaN(b)) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatRub(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatPct(value: string | number) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}%`
}

function formatNum(value: number) {
  return value.toLocaleString('ru-RU')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColMeta {
  group: ColumnGroupId
  tooltip: string
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    group: ColMeta['group']
    tooltip: ColMeta['tooltip']
  }
}

// ── Column definitions ────────────────────────────────────────────────────────

export const reportColumns: ColumnDef<ReportRow>[] = [
  // ── Identity (frozen) ─────────────────────────────────────────────────────
  {
    id: 'nmId',
    accessorKey: 'nmId',
    header: 'Арт. ВБ',
    size: 110,
    cell: ({ row }) => {
      const canExpand = row.getCanExpand()
      const isSizeRow = row.original.isSizeRow

      return (
        <span className={`flex items-center gap-1 ${isSizeRow ? 'pl-5' : ''}`}>
          {canExpand ? (
            <button
              type="button"
              onClick={row.getToggleExpandedHandler()}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
              title={row.getIsExpanded() ? 'Скрыть размеры' : 'Показать размеры'}
            >
              {row.getIsExpanded()
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <WbArticleLink nmId={row.original.nmId} photoUrl={row.original.photoUrl} />
        </span>
      )
    },
    meta: { group: 'identity', tooltip: 'Артикул товара в системе Wildberries (nmId)' },
  },
  {
    id: 'subjectName',
    accessorKey: 'subjectName',
    header: 'Категория',
    size: 160,
    meta: { group: 'identity', tooltip: 'Предметная категория товара из отчёта WB' },
  },
  {
    id: 'vendorCode',
    accessorKey: 'vendorCode',
    header: 'Артикул',
    size: 160,
    meta: { group: 'identity', tooltip: 'Артикул поставщика (с учётом переименований из справочника)' },
  },
  {
    id: 'brandName',
    accessorKey: 'brandName',
    header: 'Бренд',
    size: 120,
    meta: { group: 'identity', tooltip: 'Бренд товара из отчёта WB' },
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  {
    id: 'orderedRub',
    accessorKey: 'orderedRub',
    header: 'Заказано руб.',
    size: 130,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Сумма всех оформленных заказов WB = Σ finishedPrice из локальных wb_orders за выбранный период, включая отмены' },
  },
  {
    id: 'sale',
    accessorKey: 'sale',
    header: 'Продажа',
    size: 120,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Сумма продаж с учётом СПП = (продажи − возвраты) по цене покупателя: retailPriceWithDisc × (1 − ppvzSppPrc/100)' },
  },
  {
    id: 'toTransfer',
    accessorKey: 'toTransfer',
    header: 'К перечисл.',
    size: 120,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Сумма к перечислению от WB (ppvzForPay продаж − ppvzForPay возвратов)' },
  },
  {
    id: 'totalToPay',
    accessorKey: 'totalToPay',
    header: 'Итого к оплате',
    size: 130,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'К перечислению + доплаты − штрафы − хранение − приёмка − эквайринг − удержания' },
  },
  {
    id: 'operatingProfit',
    accessorKey: 'operatingProfit',
    header: 'ОП',
    size: 120,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Операционная прибыль = К перечислению − WB-реклама − внешн. реклама − логистика − себестоимость − хранение − комиссии/налоги/самовыкупы' },
  },
  {
    id: 'operatingProfitUnit',
    accessorKey: 'operatingProfitUnit',
    header: 'ОП ед.',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Операционная прибыль на единицу = ОП ÷ выкупленные штуки' },
  },
  {
    id: 'operatingProfitShare',
    accessorKey: 'operatingProfitShare',
    header: '% от ОП',
    size: 95,
    cell: ({ getValue, row }) => {
      if (row.original.nmId === 0) return '—'
      return formatPct(getValue<string>())
    },
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Доля ОП данного артикула в суммарной ОП по всем артикулам (двухпроходный расчёт)' },
  },
  {
    id: 'avgPrice',
    accessorKey: 'avgPrice',
    header: 'Цена ср.',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'sales', tooltip: 'Средняя цена продажи с учётом СПП = продажи с СПП ÷ количество продаж. Если выкупов нет, показывается 0' },
  },

  // ── Quantities ────────────────────────────────────────────────────────────
  {
    id: 'boughtWithReturns',
    accessorKey: 'boughtWithReturns',
    header: 'Выкуплено',
    size: 110,
    cell: ({ getValue }) => formatNum(getValue<number>()),
    meta: { group: 'quantities', tooltip: 'Выкуплено с учётом возвратов = продажи − возвраты (из quantity)' },
  },
  {
    id: 'buyoutPercent',
    accessorKey: 'buyoutPercent',
    header: 'Выкуп %',
    size: 90,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'quantities', tooltip: 'Процент выкупа = выкуплено ÷ (продажи + отмены) × 100' },
  },
  {
    id: 'boughtWithoutReturns',
    accessorKey: 'boughtWithoutReturns',
    header: 'Без возврата',
    size: 110,
    cell: ({ getValue }) => formatNum(getValue<number>()),
    meta: { group: 'quantities', tooltip: 'Выкуплено без учёта возвратов = только строки "Продажа"' },
  },
  {
    id: 'returns',
    accessorKey: 'returns',
    header: 'Возвраты',
    size: 95,
    cell: ({ getValue }) => formatNum(getValue<number>()),
    meta: { group: 'quantities', tooltip: 'Количество возвратов = строки с docTypeName = "Возврат"' },
  },

  // ── Margins ───────────────────────────────────────────────────────────────
  {
    id: 'marginality',
    accessorKey: 'marginality',
    header: 'Маржинальность',
    size: 140,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'margins', tooltip: 'Маржинальность = ОП ÷ Продажи × 100. Если и ОП, и Продажи отрицательные, показывается 0' },
  },
  {
    id: 'rentability',
    accessorKey: 'rentability',
    header: 'Рентабельность',
    size: 140,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'margins', tooltip: 'Рентабельность = ОП ÷ Себестоимость × 100. Показывает отдачу на вложенные средства' },
  },

  // ── Advertising ───────────────────────────────────────────────────────────
  {
    id: 'adBalance',
    accessorKey: 'adBalance',
    header: 'Реклама (баланс)',
    size: 140,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'advertising', tooltip: 'Расходы на внутреннюю рекламу WB из fullstats, распределённые по артикулам WB' },
  },
  {
    id: 'adAll',
    accessorKey: 'adAll',
    header: 'Реклама (все)',
    size: 130,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'advertising', tooltip: 'Все расходы на рекламу = WB реклама + внешняя реклама' },
  },
  {
    id: 'drr',
    accessorKey: 'drr',
    header: 'ДРР %',
    size: 90,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'advertising', tooltip: 'ДРР = Реклама все ÷ Продажи × 100. Доля рекламных расходов в выручке' },
  },
  {
    id: 'romi',
    accessorKey: 'romi',
    header: 'ROMI %',
    size: 95,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'advertising', tooltip: 'ROMI = (ОП + Реклама все) ÷ Реклама все × 100. Если расходов на рекламу нет, показывается 0' },
  },

  // ── Logistics ─────────────────────────────────────────────────────────────
  {
    id: 'logistics',
    accessorKey: 'logistics',
    header: 'Логистика',
    size: 110,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'logistics', tooltip: 'Расходы на логистику = сумма deliveryRub по всем строкам' },
  },
  {
    id: 'logisticsUnit',
    accessorKey: 'logisticsUnit',
    header: 'Лог. ед.',
    size: 90,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'logistics', tooltip: 'Логистика на единицу = Логистика ÷ выкуплено (продажи − возвраты)' },
  },
  {
    id: 'delivered',
    accessorKey: 'delivered',
    header: 'Доставлено',
    size: 110,
    cell: ({ getValue }) => formatNum(getValue<number>()),
    meta: { group: 'logistics', tooltip: 'Количество единиц отправленных покупателю = продажи + отмены' },
  },
  {
    id: 'logisticsFromSalesPercent',
    accessorKey: 'logisticsFromSalesPercent',
    header: 'Лог. от продаж %',
    size: 150,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'logistics', tooltip: 'Доля логистики в продажах = Логистика ÷ Продажи × 100' },
  },

  // ── References ────────────────────────────────────────────────────────────
  {
    id: 'externalAd',
    accessorKey: 'externalAd',
    header: 'Внешн. реклама',
    size: 130,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'references', tooltip: 'Внешняя реклама из справочника ExternalAd за выбранный период' },
  },
  {
    id: 'selfPurchaseCost',
    accessorKey: 'selfPurchaseCost',
    header: 'Себест. самовыкупов',
    size: 170,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'references', tooltip: 'Себестоимость самовыкупленных единиц = кол-во самовыкупов × себестоимость ед.' },
  },
  {
    id: 'cashbackDistributions',
    accessorKey: 'cashbackDistributions',
    header: 'Кэшбек',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'references', tooltip: 'Кэшбек раздач = сумма ppvzForPay по строкам самовыкупов' },
  },
  {
    id: 'selfPurchaseAmount',
    accessorKey: 'selfPurchaseAmount',
    header: 'Сумма самовыкупов',
    size: 165,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'references', tooltip: 'Сумма потраченная на самовыкупы из справочника SelfPurchase' },
  },
  {
    id: 'costPrice',
    accessorKey: 'costPrice',
    header: 'Себестоимость',
    size: 130,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'references', tooltip: 'Себестоимость = себестоимость ед. × выкупленное кол-во (из справочника CostPrice)' },
  },

  // ── Fees ──────────────────────────────────────────────────────────────────
  {
    id: 'storageFromSalesPercent',
    accessorKey: 'storageFromSalesPercent',
    header: 'Хранение %',
    size: 110,
    cell: ({ getValue }) => formatPct(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Доля хранения в продажах = Хранение ÷ Продажи × 100' },
  },
  {
    id: 'storageFee',
    accessorKey: 'storageFee',
    header: 'Хранение',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Расходы на хранение = сумма storageFee по всем строкам' },
  },
  {
    id: 'acceptance',
    accessorKey: 'acceptance',
    header: 'Приёмка',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Стоимость приёмки на складе WB = сумма acceptance' },
  },
  {
    id: 'additionalPayment',
    accessorKey: 'additionalPayment',
    header: 'Доплаты',
    size: 95,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Доплаты от WB = сумма additionalPayment (положительные значения)' },
  },
  {
    id: 'penalty',
    accessorKey: 'penalty',
    header: 'Штрафы',
    size: 95,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Штрафы от WB = сумма penalty по всем строкам' },
  },
  {
    id: 'taxes',
    accessorKey: 'taxes',
    header: 'Налоги',
    size: 95,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Налоги = Продажи × ставка налога (УСН доходы, из настроек кабинета)' },
  },
  {
    id: 'commission',
    accessorKey: 'commission',
    header: 'Комиссия',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Комиссия WB = комиссия при продажах минус комиссия при возвратах' },
  },
  {
    id: 'selfPurchases',
    accessorKey: 'selfPurchases',
    header: 'Самовыкупы',
    size: 115,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Расходы на самовыкупы = кэшбек раздач + себестоимость самовыкупов + сумма самовыкупов' },
  },
  {
    id: 'acquiringFee',
    accessorKey: 'acquiringFee',
    header: 'Эквайринг',
    size: 100,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'fees', tooltip: 'Расходы на эквайринг = эквайринг при продажах минус эквайринг при возвратах' },
  },
  {
    id: 'cancellations',
    accessorKey: 'cancellations',
    header: 'Отмены',
    size: 90,
    cell: ({ getValue }) => formatNum(getValue<number>()),
    meta: { group: 'fees', tooltip: 'Количество отменённых заказов. Заглушка = 0, будет реализовано в Фазе 8 (orders API)' },
  },

  // ── Detailed ──────────────────────────────────────────────────────────────
  {
    id: 'salesReturnsNoSpp',
    accessorKey: 'salesReturnsNoSpp',
    header: 'Прод.-возвр. без СПП',
    size: 185,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Продажи минус возвраты без WB СПП = Σ retailPriceWithDisc (прод.) − Σ retailPriceWithDisc (возвр.) — с согласованной скидкой продавца, без WB СПП' },
  },
  {
    id: 'salesWithSpp',
    accessorKey: 'salesWithSpp',
    header: 'Продажи с СПП',
    size: 140,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Сумма продаж с учётом WB СПП = Σ (retailPriceWithDisc × (1 − ppvzSppPrc/100)) по строкам "Продажа"' },
  },
  {
    id: 'returnsWithSpp',
    accessorKey: 'returnsWithSpp',
    header: 'Возвраты с СПП',
    size: 140,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Сумма возвратов с учётом WB СПП = Σ (retailPriceWithDisc × (1 − ppvzSppPrc/100)) по строкам "Возврат"' },
  },
  {
    id: 'salesNoSpp',
    accessorKey: 'salesNoSpp',
    header: 'Продажи без СПП',
    size: 150,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Сумма продаж без WB СПП = Σ retailPriceWithDisc по строкам "Продажа" (с согласованной скидкой продавца, без WB СПП)' },
  },
  {
    id: 'returnsNoSpp',
    accessorKey: 'returnsNoSpp',
    header: 'Возвраты без СПП',
    size: 155,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Сумма возвратов без WB СПП = Σ retailPriceWithDisc по строкам "Возврат" (с согласованной скидкой продавца, без WB СПП)' },
  },
  {
    id: 'commissionOnSale',
    accessorKey: 'commissionOnSale',
    header: 'Комиссия (прод.)',
    size: 145,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Комиссия WB при продажах = сумма ppvzSalesCommission по строкам "Продажа"' },
  },
  {
    id: 'commissionOnReturn',
    accessorKey: 'commissionOnReturn',
    header: 'Комиссия (возвр.)',
    size: 150,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Комиссия WB при возвратах = сумма ppvzSalesCommission по строкам "Возврат"' },
  },
  {
    id: 'deductions',
    accessorKey: 'deductions',
    header: 'Удержания',
    size: 110,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Прочие удержания/выплаты = сумма deduction по всем строкам' },
  },
  {
    id: 'salesToTransfer',
    accessorKey: 'salesToTransfer',
    header: 'Прод. к перечисл.',
    size: 155,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'К перечислению по продажам = сумма ppvzForPay по строкам "Продажа"' },
  },
  {
    id: 'returnsToTransfer',
    accessorKey: 'returnsToTransfer',
    header: 'Возвр. к перечисл.',
    size: 160,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'К перечислению по возвратам = сумма ppvzForPay по строкам "Возврат" (вычитается из продаж)' },
  },
  {
    id: 'acquiringOnSale',
    accessorKey: 'acquiringOnSale',
    header: 'Эквайринг (прод.)',
    size: 150,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Эквайринг при продажах = сумма acquiringFee по строкам "Продажа"' },
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Ярлыки',
    size: 120,
    meta: { group: 'detailed', tooltip: 'Ярлыки/теги из справочника продукта (Product.tags). Пусто до реализации.' },
  },
  {
    id: 'acquiringOnReturn',
    accessorKey: 'acquiringOnReturn',
    header: 'Эквайринг (возвр.)',
    size: 155,
    cell: ({ getValue }) => formatRub(getValue<string>()),
    sortingFn: numSort,
    meta: { group: 'detailed', tooltip: 'Эквайринг при возвратах = сумма acquiringFee по строкам "Возврат"' },
  },
]

// ── Column groups ─────────────────────────────────────────────────────────────

export const columnGroups: ColumnGroup[] = [
  {
    id: 'identity',
    label: 'Артикул',
    columnIds: ['nmId', 'subjectName', 'vendorCode', 'brandName'],
    defaultVisible: true,
  },
  {
    id: 'sales',
    label: 'Продажи',
    columnIds: ['orderedRub', 'sale', 'toTransfer', 'totalToPay', 'operatingProfit', 'operatingProfitUnit', 'operatingProfitShare', 'avgPrice'],
    defaultVisible: true,
  },
  {
    id: 'quantities',
    label: 'Количество',
    columnIds: ['boughtWithReturns', 'buyoutPercent', 'boughtWithoutReturns', 'returns'],
    defaultVisible: true,
  },
  {
    id: 'margins',
    label: 'Маржинальность',
    columnIds: ['marginality', 'rentability'],
    defaultVisible: true,
  },
  {
    id: 'advertising',
    label: 'Реклама',
    columnIds: ['adBalance', 'adAll', 'drr', 'romi'],
    defaultVisible: true,
  },
  {
    id: 'logistics',
    label: 'Логистика',
    columnIds: ['logistics', 'logisticsUnit', 'delivered', 'logisticsFromSalesPercent'],
    defaultVisible: true,
  },
  {
    id: 'references',
    label: 'Справочники',
    columnIds: ['externalAd', 'selfPurchaseCost', 'cashbackDistributions', 'selfPurchaseAmount', 'costPrice'],
    defaultVisible: true,
  },
  {
    id: 'fees',
    label: 'Комиссии',
    columnIds: ['storageFromSalesPercent', 'storageFee', 'acceptance', 'additionalPayment', 'penalty', 'taxes', 'commission', 'selfPurchases', 'acquiringFee', 'cancellations'],
    defaultVisible: true,
  },
  {
    id: 'detailed',
    label: 'Детализация',
    columnIds: ['salesReturnsNoSpp', 'salesWithSpp', 'returnsWithSpp', 'salesNoSpp', 'returnsNoSpp', 'commissionOnSale', 'commissionOnReturn', 'deductions', 'salesToTransfer', 'returnsToTransfer', 'acquiringOnSale', 'tags', 'acquiringOnReturn'],
    defaultVisible: false,
  },
]

export function getDefaultColumnVisibility(): Record<string, boolean> {
  const visibility: Record<string, boolean> = {}
  for (const group of columnGroups) {
    for (const colId of group.columnIds) {
      visibility[colId] = group.defaultVisible
    }
  }
  return visibility
}
