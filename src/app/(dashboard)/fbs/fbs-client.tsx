'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DateRange } from 'react-day-picker'
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/date-range-picker'
import { MobileSortControls } from '@/components/mobile-sort-controls'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  addFbsAssortmentItemAction,
  adjustFbsInventoryAction,
  assignKizToOrderAction,
  attachAssignedKizToWbAction,
  closeFbsSupplyInWbAction,
  configureFbsAssortmentAction,
  confirmKizComplianceBatchAction,
  confirmKizComplianceTaskAction,
  exportKizComplianceTasksAction,
  getFbsSyncJobStatusAction,
  getFbsHistoryPageAction,
  getFbsOrderStickersAction,
  importKizXlsxAction,
  markPhysicalKizReturnAction,
  markKizExceptionAction,
  moveOrderToFbsSupplyAction,
  publishFbsWarehouseStocksAction,
  registerKizAction,
  releaseReturnedKizFromQuarantineAction,
  setFbsWarehouseWriteEnabledAction,
  syncFbsAction,
  updateFbsOrderStatusInWbAction,
} from '@/lib/actions/fbs'
import { SYNC_JOB_KINDS, type SyncJobKind } from '@/types/sync'
import type { FbsWorkspaceData } from '@/types/fbs'
import type { KizComplianceExportKind } from '@/lib/fbs/compliance-export'
import type { FbsHistoryRow, FbsHistorySection } from '@/lib/services/fbs-history'
import {
  FBS_STATUS_ACTION_LABELS,
  getFbsActionKindLabel,
  getFbsActionStatusLabel,
  getFbsSupplierStatusLabel,
  getFbsWbStatusLabel,
  getKizComplianceStatusLabel,
} from '@/lib/fbs/status-labels'

interface FbsClientProps {
  data: FbsWorkspaceData
  accounts: Array<{ id: string; name: string }>
  dateFrom: string
  dateTo: string
}

const PHYSICAL_LABELS: Record<string, string> = {
  IN_STOCK: 'На складе',
  RESERVED: 'В резерве',
  HANDED_OVER: 'Передан WB',
  RETURN_EXPECTED: 'Ожидается возврат',
  QUARANTINE: 'Карантин',
  LOST: 'Утрачен',
  WRITTEN_OFF: 'Списан',
}

const CIRCULATION_LABELS: Record<string, string> = {
  UNKNOWN: 'Статус в ЧЗ не указан',
  COMMISSIONING_REQUIRED: 'Нужен ввод',
  IN_CIRCULATION: 'В обороте',
  WITHDRAWAL_REQUIRED: 'Требуется вывод из оборота',
  WITHDRAWN: 'Выведен из оборота',
  RETURN_TO_CIRCULATION_REQUIRED: 'Требуется возврат в оборот',
}

const WB_KIZ_VALIDATION_LABELS: Record<string, string> = {
  VALID: 'Подтверждён WB',
  GTIN_MISMATCH: 'Не совпадает GTIN',
  ORDER_CONFLICT: 'КИЗ в другом заказе',
  STATE_CONFLICT: 'Конфликт состояния',
}

const ORDER_SORT_OPTIONS = [
  { value: 'externalOrderId', label: 'Заказ WB' },
  { value: 'createdAtWb', label: 'Создан' },
  { value: 'vendorCode', label: 'Артикул' },
  { value: 'warehouseName', label: 'Склад' },
  { value: 'status', label: 'Статусы' },
  { value: 'kizCode', label: 'КИЗ' },
  { value: 'metadata', label: 'Метаданные WB' },
] as const

const ASSORTMENT_SORT_OPTIONS = [
  { value: 'warehouseName', label: 'Склад' },
  { value: 'vendorCode', label: 'Артикул' },
  { value: 'chrtId', label: 'chrtId' },
  { value: 'onHand', label: 'Физически на складе' },
  { value: 'reserved', label: 'Резерв заказов' },
  { value: 'available', label: 'Доступно локально' },
  { value: 'wbStock', label: 'Остаток WB' },
  { value: 'marking', label: 'Маркировка' },
] as const

const SUPPLY_SORT_OPTIONS = [
  { value: 'name', label: 'Поставка' },
  { value: 'warehouseName', label: 'Склад' },
  { value: 'orderCount', label: 'Заказов' },
  { value: 'isB2b', label: 'B2B' },
  { value: 'done', label: 'Статус' },
] as const

const TASK_LABELS: Record<string, string> = {
  COMMISSIONING: 'Ввод в оборот',
  WITHDRAWAL_REMOTE_SALE: 'Вывод после отгрузки: дистанционная продажа',
  WITHDRAWAL_B2B: 'Вывод: B2B',
  RETURN_TO_CIRCULATION: 'Возврат в оборот',
  RELABEL: 'Перемаркировка',
}

export function FbsClient({ data, accounts, dateFrom, dateTo }: FbsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [syncingKind, setSyncingKind] = useState<SyncJobKind | null>(null)
  const [selectedItemId, setSelectedItemId] = useState(data.assortment[0]?.id ?? '')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(data.warehouses[0]?.id ?? '')
  const [selectedProductSizeId, setSelectedProductSizeId] = useState(data.catalogCandidates[0]?.productSizeId ?? '')
  const [selectedOrderId, setSelectedOrderId] = useState(data.orders[0]?.id ?? '')
  const [selectedKizId, setSelectedKizId] = useState(
    data.kizUnits.find((unit) => unit.physicalState === 'IN_STOCK')?.id ?? '',
  )
  const [selectedSupplyId, setSelectedSupplyId] = useState(
    data.supplies.find((supply) => !supply.done)?.id ?? '',
  )
  const [stockDelta, setStockDelta] = useState('1')
  const [stockNote, setStockNote] = useState('')
  const [kizCode, setKizCode] = useState('')
  const [returnKizCode, setReturnKizCode] = useState('')
  const [quarantineKizId, setQuarantineKizId] = useState(
    data.kizUnits.find((unit) => unit.physicalState === 'QUARANTINE')?.id ?? '',
  )
  const [exceptionKizId, setExceptionKizId] = useState(
    data.kizUnits.find((unit) => unit.physicalState === 'IN_STOCK')?.id ?? '',
  )
  const [exceptionNote, setExceptionNote] = useState('')
  const [circulationState, setCirculationState] = useState<
    'UNKNOWN' | 'COMMISSIONING_REQUIRED' | 'IN_CIRCULATION'
  >('UNKNOWN')
  const [selectedTaskId, setSelectedTaskId] = useState(
    data.complianceTasks.find((task) => task.status !== 'CONFIRMED')?.id ?? '',
  )
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedBatchId, setSelectedBatchId] = useState(
    data.operationBatches.find((batch) => batch.pendingCount > 0)?.id ?? '',
  )
  const [batchDocumentNumber, setBatchDocumentNumber] = useState('')
  const [batchDocumentDate, setBatchDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [analyticsFrom, setAnalyticsFrom] = useState(dateFrom)
  const [analyticsTo, setAnalyticsTo] = useState(dateTo)
  const [overviewQuery, setOverviewQuery] = useState('')
  const [orderQuery, setOrderQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('ALL')
  const [assortmentQuery, setAssortmentQuery] = useState('')
  const [assortmentFilter, setAssortmentFilter] = useState('ALL')
  const [kizQuery, setKizQuery] = useState('')
  const [kizFilter, setKizFilter] = useState('ALL')
  const [complianceQuery, setComplianceQuery] = useState('')
  const [complianceFilter, setComplianceFilter] = useState('ALL')
  const [supplyQuery, setSupplyQuery] = useState('')
  const [supplyFilter, setSupplyFilter] = useState('ALL')
  const [analyticsQuery, setAnalyticsQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [activeTab, setActiveTab] = useState('orders')
  const [historyRange, setHistoryRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [orderSort, setOrderSort] = useState<TableSort>({ key: 'createdAtWb', direction: 'desc' })
  const [assortmentSort, setAssortmentSort] = useState<TableSort>({ key: 'vendorCode', direction: 'asc' })
  const [kizSort, setKizSort] = useState<TableSort>({ key: 'code', direction: 'asc' })
  const [complianceSort, setComplianceSort] = useState<TableSort>({ key: 'status', direction: 'asc' })
  const [supplySort, setSupplySort] = useState<TableSort>({ key: 'done', direction: 'asc' })
  const [analyticsSort, setAnalyticsSort] = useState<TableSort>({ key: 'revenue', direction: 'desc' })
  const fileRef = useRef<HTMLInputElement>(null)

  const availableKiz = useMemo(
    () => data.kizUnits.filter((unit) => ['IN_STOCK', 'RESERVED'].includes(unit.physicalState)),
    [data.kizUnits],
  )

  const filteredWarehouses = useMemo(
    () => data.warehouses.filter((warehouse) => matchesSearch(
      overviewQuery,
      warehouse.name,
      warehouse.externalId,
    )),
    [data.warehouses, overviewQuery],
  )

  const orderHistory = useFbsServerTable<FbsWorkspaceData['orders'][number]>({
    wbAccountId: data.account.id, section: 'orders', initialRows: data.orders,
    initialTotal: data.rowCounts.orders, query: orderQuery, filter: orderFilter, sort: orderSort,
    dateRange: historyRange,
  })

  const filteredAssortment = useMemo(() => data.assortment.filter((item) => {
    const matchesFilter = assortmentFilter === 'ALL'
      || (assortmentFilter === 'MARKED' && item.requiresKiz)
      || (assortmentFilter === 'UNMARKED' && !item.requiresKiz)
      || (assortmentFilter === 'MISMATCH' && item.available !== item.wbStock)

    return matchesFilter && matchesSearch(
      assortmentQuery,
      item.vendorCode,
      item.barcode,
      item.nmId,
      item.chrtId,
      item.warehouseName,
      item.markingGtin,
    )
  }), [assortmentFilter, assortmentQuery, data.assortment])

  const kizHistory = useFbsServerTable<FbsWorkspaceData['kizUnits'][number]>({
    wbAccountId: data.account.id, section: 'kizUnits', initialRows: data.kizUnits,
    initialTotal: data.rowCounts.kizUnits, query: kizQuery, filter: kizFilter, sort: kizSort,
    dateRange: historyRange,
  })

  const complianceHistory = useFbsServerTable<FbsWorkspaceData['complianceTasks'][number]>({
    wbAccountId: data.account.id, section: 'complianceTasks', initialRows: data.complianceTasks,
    initialTotal: data.rowCounts.complianceTasks, query: complianceQuery, filter: complianceFilter, sort: complianceSort,
    dateRange: historyRange,
  })

  const supplyHistory = useFbsServerTable<FbsWorkspaceData['supplies'][number]>({
    wbAccountId: data.account.id, section: 'supplies', initialRows: data.supplies,
    initialTotal: data.rowCounts.supplies, query: supplyQuery, filter: supplyFilter, sort: supplySort,
    dateRange: historyRange,
  })

  const filteredFinanceByArticle = useMemo(
    () => data.financeByArticle.filter((row) => matchesSearch(
      analyticsQuery,
      row.vendorCode,
      row.nmId,
    )),
    [analyticsQuery, data.financeByArticle],
  )

  const actionHistory = useFbsServerTable<FbsWorkspaceData['recentActions'][number]>({
    wbAccountId: data.account.id, section: 'recentActions', initialRows: data.recentActions,
    initialTotal: data.rowCounts.recentActions, query: actionQuery,
    filter: 'ALL', sort: { key: 'createdAt', direction: 'desc' },
    dateRange: historyRange,
  })

  const assortmentView = useTableView(filteredAssortment, assortmentSort, assortmentSortValue)
  const analyticsView = useTableView(filteredFinanceByArticle, analyticsSort, analyticsSortValue)
  const analyticsRange = useMemo<DateRange>(() => ({
    from: parseDateValue(analyticsFrom),
    to: parseDateValue(analyticsTo),
  }), [analyticsFrom, analyticsTo])

  useEffect(() => {
    const selectedIsPending = data.operationBatches.some(
      (batch) => batch.id === selectedBatchId && batch.pendingCount > 0,
    )
    if (!selectedIsPending) {
      setSelectedBatchId(data.operationBatches.find((batch) => batch.pendingCount > 0)?.id ?? '')
    }
  }, [data.operationBatches, selectedBatchId])

  function refresh() {
    router.refresh()
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(success)
        refresh()
      } else {
        toast.error(result.error ?? 'Операция не выполнена')
      }
    })
  }

  async function runSync(
    kind:
      | typeof SYNC_JOB_KINDS.FBS_OPERATIONAL
      | typeof SYNC_JOB_KINDS.FBS_STOCKS_CURRENT,
    label: string,
  ) {
    setSyncingKind(kind)
    try {
      const queued = await syncFbsAction(data.account.id, kind)
      if (!queued.success) {
        toast.error(queued.error)
        return
      }

      toast.success(`${label}: задача поставлена в очередь`)
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2_000))
        const status = await getFbsSyncJobStatusAction(queued.data.id)
        if (!status.success) {
          toast.error(status.error)
          return
        }
        if (status.data.status === 'FAILED') {
          toast.error(status.data.error ?? `${label}: синхронизация завершилась с ошибкой`)
          return
        }
        if (status.data.status === 'SUCCEEDED') {
          toast.success(`${label}: данные обновлены`)
          refresh()
          return
        }
      }
      toast.warning(`${label}: задача всё ещё выполняется, данные появятся после обновления страницы`)
    } finally {
      setSyncingKind(null)
    }
  }

  function switchAccount(account: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('account', account)
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyPeriod() {
    const params = new URLSearchParams(searchParams.toString())
    if (analyticsFrom) params.set('dateFrom', analyticsFrom)
    else params.delete('dateFrom')
    if (analyticsTo) params.set('dateTo', analyticsTo)
    else params.delete('dateTo')
    router.push(`${pathname}?${params.toString()}`)
  }

  async function importXlsx(file: File) {
    const base64 = await fileToBase64(file)
    startTransition(async () => {
      const result = await importKizXlsxAction({ wbAccountId: data.account.id, base64 })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const tail = result.data.errors.length ? `, ошибок: ${result.data.errors.length}` : ''
      toast.success(`Импортировано: ${result.data.imported}, дублей: ${result.data.duplicates}${tail}`)
      if (result.data.errors.length) toast.warning(result.data.errors.slice(0, 3).join('\n'))
      refresh()
    })
  }

  async function exportCompliance(kind: KizComplianceExportKind, label: string) {
    startTransition(async () => {
      const result = await exportKizComplianceTasksAction({ wbAccountId: data.account.id, kind })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      downloadBase64(result.data.base64, result.data.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      setSelectedBatchId(result.data.batchId)
      toast.success(`${label}: ${result.data.taskCount}`)
      refresh()
    })
  }

  function confirmComplianceBatch() {
    const batch = data.operationBatches.find((candidate) => candidate.id === selectedBatchId)
    if (!batch) {
      toast.error('Выберите выгруженный пакет')
      return
    }
    if (!window.confirm(`Подтвердить обработку всего файла «${batch.filename}» (${batch.pendingCount} КИЗ)?`)) {
      return
    }
    startTransition(async () => {
      const result = await confirmKizComplianceBatchAction({
        wbAccountId: data.account.id,
        batchId: batch.id,
        documentNumber: batchDocumentNumber,
        documentDate: batchDocumentDate,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.data.alreadyProcessed
          ? 'Этот пакет уже был подтверждён'
          : `Массово подтверждено КИЗов: ${result.data.confirmed}`,
      )
      refresh()
    })
  }

  async function downloadSticker(orderId: string) {
    startTransition(async () => {
      const result = await getFbsOrderStickersAction({
        wbAccountId: data.account.id,
        orderIds: [orderId],
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const sticker = result.data[0]
      if (!sticker?.file) {
        toast.error('WB не вернул файл стикера')
        return
      }
      downloadBase64(sticker.file, `fbs_sticker_${sticker.orderId}.png`, 'image/png')
    })
  }

  return (
    <div className="dashboard-page gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="metric-label">Склад продавца</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">FBS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Остатки NimbaOS, заказы WB, КИЗы и ручная очередь Честного знака.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select value={data.account.id} onValueChange={switchAccount}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!data.permissions.canOperate || pending || Boolean(syncingKind)}
            onClick={() =>
              runSync(SYNC_JOB_KINDS.FBS_OPERATIONAL, 'Заказы FBS')
            }
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncingKind === SYNC_JOB_KINDS.FBS_OPERATIONAL ? 'animate-spin' : ''}`} />
            Заказы
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!data.permissions.canOperate || pending || Boolean(syncingKind)}
            onClick={() =>
              runSync(SYNC_JOB_KINDS.FBS_STOCKS_CURRENT, 'Остатки FBS')
            }
          >
            <Boxes className={`mr-2 h-4 w-4 ${syncingKind === SYNC_JOB_KINDS.FBS_STOCKS_CURRENT ? 'animate-pulse' : ''}`} />
            Сверить остатки
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Физически на складе" value={formatNumber(data.metrics.onHand)} />
        <Metric label="Резерв заказов" value={formatNumber(data.metrics.reserved)} />
        <Metric label="Доступно локально" value={formatNumber(data.metrics.available)} />
        <Metric label="Остаток WB" value={formatNumber(data.metrics.wbStock)} />
        <Metric label="Расхождение с WB" value={formatNumber(data.metrics.stockMismatch)} warning={data.metrics.stockMismatch > 0} />
        <Metric label="Открытые заказы" value={formatNumber(data.metrics.openOrders)} />
        <Metric label="Операции ЧЗ" value={formatNumber(data.metrics.openComplianceTasks)} warning={data.metrics.openComplianceTasks > 0} />
      </section>
      <p className="text-xs text-muted-foreground">
        «Остаток WB» — количество, которое WB считает доступным для продажи по FBS. Остальные три показателя —
        независимый локальный учёт NimbaOS: физический остаток минус резерв заказов равен доступному остатку.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="flex h-auto flex-wrap justify-start sm:h-auto">
          <TabsTrigger value="overview">Сводка</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="warehouse">Свой склад</TabsTrigger>
          <TabsTrigger value="kiz">КИЗы</TabsTrigger>
          <TabsTrigger value="compliance">Честный знак</TabsTrigger>
          <TabsTrigger value="supplies">Поставки</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>
        {!['overview', 'warehouse'].includes(activeTab) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
            <span className="text-xs font-medium text-muted-foreground">Период истории:</span>
            <DateRangePicker
              value={historyRange}
              onChange={setHistoryRange}
              className="w-full min-w-0 sm:w-auto"
            />
            {(historyRange.from || historyRange.to) && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryRange({ from: undefined, to: undefined })}>
                Вся история
              </Button>
            )}
            <span className="text-xs text-muted-foreground">Применяется к заказам, КИЗам, ЧЗ, поставкам и журналу WB.</span>
          </div>
        )}

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Склады продавца</CardTitle>
              <CardDescription>NimbaOS — источник локального остатка; WB показывается для сверки.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FilterBar
                query={overviewQuery}
                onQueryChange={setOverviewQuery}
                placeholder="Поиск по складу или WB ID"
              />
              <p className="text-xs text-muted-foreground">
                Складов: {filteredWarehouses.length} из {data.rowCounts.warehouses}
              </p>
              {filteredWarehouses.map((warehouse) => (
                <div key={warehouse.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-xs text-muted-foreground">WB ID {warehouse.externalId}</p>
                  </div>
                  <div className="w-full text-left text-sm tabular-nums sm:w-auto sm:text-right">
                    <p>Локально доступно: <b>{warehouse.available}</b> · Остаток WB: <b>{warehouse.wbStock}</b></p>
                    <Badge variant={warehouse.writeEnabled ? 'destructive' : 'secondary'}>
                      {warehouse.writeEnabled ? 'Операции в WB разрешены' : 'WB только чтение'}
                    </Badge>
                  </div>
                </div>
              ))}
              {!filteredWarehouses.length && (
                <Empty text={data.warehouses.length ? 'Склады по фильтру не найдены.' : 'Запустите синхронизацию FBS, чтобы загрузить склады.'} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Контроль исключений</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Exception label="Просроченные заказы" value={data.metrics.overdueOrders} />
              <Exception label="КИЗы в карантине" value={data.metrics.quarantinedKiz} />
              <Exception label="Расхождение остатков" value={data.metrics.stockMismatch} />
              <Exception label="Открытые операции ЧЗ" value={data.metrics.openComplianceTasks} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Операции с заказом</CardTitle>
              <CardDescription>Любое изменение WB выполняется только кнопкой и попадает в журнал.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger><SelectValue placeholder="Заказ WB" /></SelectTrigger>
                <SelectContent>
                  {data.orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.externalOrderId} · {order.vendorCode ?? order.barcode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedKizId} onValueChange={setSelectedKizId}>
                <SelectTrigger><SelectValue placeholder="Доступный КИЗ" /></SelectTrigger>
                <SelectContent>
                  {availableKiz.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!selectedOrderId || !selectedKizId || !data.permissions.canOperate || pending}
                  onClick={() =>
                    run(
                      () => assignKizToOrderAction({
                        wbAccountId: data.account.id,
                        orderId: selectedOrderId,
                        kizUnitId: selectedKizId,
                      }),
                      'КИЗ назначен заказу',
                    )
                  }
                >
                  Назначить КИЗ
                </Button>
                <Button
                  variant="outline"
                  disabled={!selectedOrderId || !data.permissions.canOperate || pending}
                  onClick={() =>
                    run(
                      () => attachAssignedKizToWbAction({ wbAccountId: data.account.id, orderId: selectedOrderId }),
                      'КИЗ закреплён в WB',
                    )
                  }
                >
                  Закрепить в WB
                </Button>
                {(['confirm', 'complete', 'cancel'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={status === 'cancel' ? 'destructive' : 'outline'}
                    disabled={!selectedOrderId || !data.permissions.canOperate || pending}
                    onClick={() => {
                      const statusLabel = FBS_STATUS_ACTION_LABELS[status]
                      if (!window.confirm(`Отправить в WB действие «${statusLabel}»?`)) return
                      run(
                        () => updateFbsOrderStatusInWbAction({
                          wbAccountId: data.account.id,
                          orderId: selectedOrderId,
                          status,
                        }),
                        `Действие «${statusLabel}» отправлено в WB`,
                      )
                    }}
                  >
                    {FBS_STATUS_ACTION_LABELS[status]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <FilterBar
            query={orderQuery}
            onQueryChange={setOrderQuery}
            placeholder="Заказ, артикул, склад, КИЗ или статус"
          >
            <Select value={orderFilter} onValueChange={setOrderFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все заказы</SelectItem>
                <SelectItem value="ACTIVE">Активные</SelectItem>
                <SelectItem value="CANCELED">Отменённые</SelectItem>
                <SelectItem value="RETURN">Отмена при получении / брак</SelectItem>
                <SelectItem value="NEEDS_KIZ">Требуют КИЗ</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <MobileSortControls
            value={orderSort.key}
            direction={orderSort.direction}
            options={ORDER_SORT_OPTIONS}
            onFieldChange={(key) => setOrderSort(nextSort(orderSort, key))}
            onDirectionToggle={() => setOrderSort(nextSort(orderSort, orderSort.key))}
            className="lg:hidden"
          />
          <div className="grid gap-3 lg:hidden">
            {orderHistory.rows.map((order) => (
              <article key={order.id} className="rounded-md border bg-card p-3 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold">Заказ {order.externalOrderId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAtWb)}</p>
                  </div>
                  <Badge variant={order.metadataReady ? 'secondary' : 'destructive'}>
                    {order.metadataLabel}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <MobileField label="Артикул" value={order.vendorCode ?? order.barcode} />
                  <MobileField label="Склад" value={order.warehouseName ?? '—'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Badge variant="outline">Продавец: {getFbsSupplierStatusLabel(order.supplierStatus)}</Badge>
                  <Badge variant="secondary">WB: {getFbsWbStatusLabel(order.wbStatus)}</Badge>
                  {order.kizCode ? (
                    <Badge variant="outline" className="max-w-full break-all font-mono">КИЗ: {order.kizCode}</Badge>
                  ) : order.requiresKiz ? (
                    <Badge variant="destructive">Нужен КИЗ</Badge>
                  ) : null}
                </div>
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  disabled={!data.permissions.canOperate || pending}
                  onClick={() => downloadSticker(order.id)}
                >
                  <Barcode className="mr-2 h-4 w-4" /> Скачать стикер PNG
                </Button>
              </article>
            ))}
            {!orderHistory.rows.length && (
              <MobileEmpty text={data.rowCounts.orders ? 'Заказы по фильтру не найдены.' : 'Заказы FBS ещё не синхронизированы.'} />
            )}
          </div>
          <DataTable className="hidden lg:block">
            <TableHeader>
              <TableRow>
                <SortableHead label="Заказ WB" sortKey="externalOrderId" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="Создан" sortKey="createdAtWb" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="Артикул" sortKey="vendorCode" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="Склад" sortKey="warehouseName" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="Статусы" sortKey="status" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="КИЗ" sortKey="kizCode" sort={orderSort} onSort={setOrderSort} />
                <SortableHead label="Метаданные WB" sortKey="metadata" sort={orderSort} onSort={setOrderSort} />
                <TableHead>Стикер</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderHistory.rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.externalOrderId}</TableCell>
                  <TableCell>{formatDate(order.createdAtWb)}</TableCell>
                  <TableCell>{order.vendorCode ?? order.barcode}</TableCell>
                  <TableCell>{order.warehouseName ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                      >
                        Продавец: {getFbsSupplierStatusLabel(order.supplierStatus)}
                      </Badge>
                      <Badge
                        variant="secondary"
                      >
                        WB: {getFbsWbStatusLabel(order.wbStatus)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.kizCode ?? (order.requiresKiz ? <Badge variant="destructive">Нужен КИЗ</Badge> : '—')}</TableCell>
                  <TableCell>
                    <Badge
                      variant={order.metadataReady ? 'secondary' : 'destructive'}
                      title={order.metadataIssue ?? 'WB подтвердил необходимые метаданные заказа'}
                    >
                      {order.metadataLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!data.permissions.canOperate || pending}
                      onClick={() => downloadSticker(order.id)}
                    >
                      <Barcode className="mr-1 h-4 w-4" /> PNG
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!orderHistory.rows.length && <EmptyRow colSpan={8} text={data.rowCounts.orders ? 'Заказы по фильтру не найдены.' : 'Заказы FBS ещё не синхронизированы.'} />}
            </TableBody>
          </DataTable>
          <ServerTablePager table={orderHistory} />
        </TabsContent>

        <TabsContent value="warehouse" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">FBS-ассортимент</CardTitle>
              <CardDescription>Добавьте размер из карточек кабинета на выбранный склад продавца.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Склад продавца" /></SelectTrigger>
                <SelectContent>
                  {data.warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CatalogCandidateSelect
                items={data.catalogCandidates}
                value={selectedProductSizeId}
                onChange={setSelectedProductSizeId}
              />
              <Button
                disabled={!selectedWarehouseId || !selectedProductSizeId || !data.permissions.canOperate || pending}
                onClick={() =>
                  run(
                    () => addFbsAssortmentItemAction({
                      wbAccountId: data.account.id,
                      warehouseId: selectedWarehouseId,
                      productSizeId: selectedProductSizeId,
                    }),
                    'Артикул добавлен на FBS',
                  )
                }
              >
                Добавить
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Корректировка локального остатка</CardTitle>
              <CardDescription>Резерв уменьшает доступное количество, но не физический остаток.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]">
              <ItemSelect items={data.assortment} value={selectedItemId} onChange={setSelectedItemId} />
              <Input type="number" value={stockDelta} onChange={(event) => setStockDelta(event.target.value)} />
              <Input value={stockNote} onChange={(event) => setStockNote(event.target.value)} placeholder="Причина корректировки" />
              <Button
                disabled={!selectedItemId || !data.permissions.canOperate || pending}
                onClick={() =>
                  run(
                    () => adjustFbsInventoryAction({
                      wbAccountId: data.account.id,
                      assortmentItemId: selectedItemId,
                      quantityDelta: Number(stockDelta),
                      note: stockNote,
                    }),
                    'Остаток скорректирован',
                  )
                }
              >
                Провести
              </Button>
            </CardContent>
          </Card>

          <FilterBar
            query={assortmentQuery}
            onQueryChange={setAssortmentQuery}
            placeholder="Артикул, barcode, nmId, chrtId или склад"
          >
            <Select value={assortmentFilter} onValueChange={setAssortmentFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Весь ассортимент</SelectItem>
                <SelectItem value="MARKED">С маркировкой</SelectItem>
                <SelectItem value="UNMARKED">Без маркировки</SelectItem>
                <SelectItem value="MISMATCH">Расхождение с WB</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <MobileSortControls
            value={assortmentSort.key}
            direction={assortmentSort.direction}
            options={ASSORTMENT_SORT_OPTIONS}
            onFieldChange={(key) => setAssortmentSort(nextSort(assortmentSort, key))}
            onDirectionToggle={() => setAssortmentSort(nextSort(assortmentSort, assortmentSort.key))}
            className="lg:hidden"
          />
          <div className="grid gap-3 lg:hidden">
            {assortmentView.rows.map((item) => (
              <article key={item.id} className="rounded-md border bg-card p-3 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{item.vendorCode ?? item.barcode}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{item.warehouseName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">chrtId {item.chrtId}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MobileField label="Физически" value={formatNumber(item.onHand)} />
                  <MobileField label="Резерв" value={formatNumber(item.reserved)} />
                  <MobileField label="Доступно" value={formatNumber(item.available)} emphasized />
                  <MobileField
                    label="Остаток WB"
                    value={formatNumber(item.wbStock)}
                    warning={item.available !== item.wbStock}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-auto min-h-11 w-full whitespace-normal"
                  disabled={!data.permissions.canOperate || pending}
                  onClick={() =>
                    run(
                      () => configureFbsAssortmentAction({
                        wbAccountId: data.account.id,
                        assortmentItemId: item.id,
                        requiresKiz: !item.requiresKiz,
                        markingGtin: item.markingGtin,
                      }),
                      item.requiresKiz ? 'Признак маркировки снят' : 'Признак маркировки установлен',
                    )
                  }
                >
                  {item.requiresKiz ? `Маркировка: КИЗ${item.markingGtin ? ` · ${item.markingGtin}` : ''}` : 'Маркировка не требуется'}
                </Button>
              </article>
            ))}
            {!filteredAssortment.length && (
              <MobileEmpty text={data.assortment.length ? 'Товары по фильтру не найдены.' : 'FBS-артикулы появятся после загрузки заказов.'} />
            )}
          </div>
          <DataTable className="hidden lg:block">
            <TableHeader>
              <TableRow>
                <SortableHead label="Склад" sortKey="warehouseName" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Артикул" sortKey="vendorCode" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="chrtId" sortKey="chrtId" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Физически на складе" sortKey="onHand" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Резерв заказов" sortKey="reserved" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Доступно локально" sortKey="available" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Остаток WB" sortKey="wbStock" sort={assortmentSort} onSort={setAssortmentSort} />
                <SortableHead label="Маркировка" sortKey="marking" sort={assortmentSort} onSort={setAssortmentSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assortmentView.rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.warehouseName}</TableCell>
                  <TableCell className="font-medium">{item.vendorCode ?? item.barcode}</TableCell>
                  <TableCell>{item.chrtId}</TableCell>
                  <TableCell>{item.onHand}</TableCell><TableCell>{item.reserved}</TableCell>
                  <TableCell className="font-semibold">{item.available}</TableCell>
                  <TableCell className={item.available !== item.wbStock ? 'text-destructive' : ''}>{item.wbStock}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!data.permissions.canOperate || pending}
                      className="min-h-11 rounded-md text-left md:min-h-0"
                      onClick={() =>
                        run(
                          () => configureFbsAssortmentAction({
                            wbAccountId: data.account.id,
                            assortmentItemId: item.id,
                            requiresKiz: !item.requiresKiz,
                            markingGtin: item.markingGtin,
                          }),
                          item.requiresKiz ? 'Признак маркировки снят' : 'Признак маркировки установлен',
                        )
                      }
                    >
                      <Badge variant={item.requiresKiz ? 'default' : 'outline'}>
                        {item.requiresKiz ? `КИЗ${item.markingGtin ? ` · ${item.markingGtin}` : ''}` : 'Не требуется'}
                      </Badge>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredAssortment.length && <EmptyRow colSpan={8} text={data.assortment.length ? 'Товары по фильтру не найдены.' : 'FBS-артикулы появятся после загрузки заказов.'} />}
            </TableBody>
          </DataTable>
          <TablePager view={assortmentView} loadedCount={data.assortment.length} totalCount={data.rowCounts.assortment} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Передача локальных остатков в WB</CardTitle>
              <CardDescription>
                По умолчанию WB доступен только для чтения. Разрешение операций само ничего не отправляет:
                остаток изменится в WB только после отдельного нажатия «Передать остатки в WB».
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.warehouses.map((warehouse) => (
                <div key={warehouse.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-xs text-muted-foreground">NimbaOS {warehouse.available} · WB {warehouse.wbStock}</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {data.permissions.canEnableWbWrites && (
                      <Button
                        variant="outline"
                        className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`${warehouse.writeEnabled ? 'Запретить' : 'Разрешить'} операции в WB для этого склада? Само переключение остатки не отправляет.`)) return
                          run(
                            () => setFbsWarehouseWriteEnabledAction({
                              wbAccountId: data.account.id,
                              warehouseId: warehouse.id,
                              enabled: !warehouse.writeEnabled,
                            }),
                            'Режим операций с WB обновлён',
                          )
                        }}
                      >
                        {warehouse.writeEnabled ? 'Запретить операции в WB' : 'Разрешить операции в WB'}
                      </Button>
                    )}
                    <Button
                      className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
                      disabled={!warehouse.writeEnabled || !data.permissions.canOperate || pending}
                      onClick={() => {
                        if (!window.confirm(`Передать в WB локальный доступный остаток: ${warehouse.available} ед.? Это заменит текущее количество WB для ассортимента склада.`)) return
                        run(
                          () => publishFbsWarehouseStocksAction({
                            wbAccountId: data.account.id,
                            warehouseId: warehouse.id,
                          }),
                          'Остатки опубликованы в WB',
                        )
                      }}
                    >
                      Передать остатки в WB
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kiz" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-4 w-4" /> Сканер КИЗ</CardTitle>
                <CardDescription>Поддерживается клавиатурный сканер; префикс ]d2 и GS сохраняются корректно.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ItemSelect items={data.assortment} value={selectedItemId} onChange={setSelectedItemId} />
                <Input value={kizCode} onChange={(event) => setKizCode(event.target.value)} placeholder="Отсканируйте DataMatrix" />
                <Select value={circulationState} onValueChange={(value) => setCirculationState(value as typeof circulationState)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNKNOWN">Статус в ЧЗ не указан</SelectItem>
                    <SelectItem value="COMMISSIONING_REQUIRED">Нужно ввести в оборот</SelectItem>
                    <SelectItem value="IN_CIRCULATION">Уже в обороте</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={!selectedItemId || !kizCode || !data.permissions.canOperate || pending}
                  onClick={() =>
                    run(
                      () => registerKizAction({
                        wbAccountId: data.account.id,
                        assortmentItemId: selectedItemId,
                        rawCode: kizCode,
                        circulationState,
                      }),
                      'КИЗ зарегистрирован',
                    )
                  }
                >
                  Зарегистрировать
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4" /> XLSX и возвраты</CardTitle>
                <CardDescription>Импорт: КИЗ, склад, chrtId или barcode, статус оборота.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importXlsx(file)
                    event.target.value = ''
                  }}
                />
                <Button variant="outline" disabled={!data.permissions.canOperate || pending} onClick={() => fileRef.current?.click()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Импортировать XLSX
                </Button>
                <div className="border-t pt-3">
                  <Label>Физический возврат</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input value={returnKizCode} onChange={(event) => setReturnKizCode(event.target.value)} placeholder="Отсканируйте возвратный КИЗ" />
                    <Button
                      className="w-full sm:w-auto"
                      disabled={!returnKizCode || !data.permissions.canOperate || pending}
                      onClick={() =>
                        run(
                          () => markPhysicalKizReturnAction({ wbAccountId: data.account.id, rawCode: returnKizCode }),
                          'КИЗ принят в карантин',
                        )
                      }
                    >
                      Принять
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Select value={quarantineKizId} onValueChange={setQuarantineKizId}>
                      <SelectTrigger><SelectValue placeholder="КИЗ после осмотра" /></SelectTrigger>
                      <SelectContent>
                        {data.kizUnits.filter((unit) => unit.physicalState === 'QUARANTINE').map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>{unit.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!quarantineKizId || !data.permissions.canOperate || pending}
                      onClick={() =>
                        run(
                          () => releaseReturnedKizFromQuarantineAction({
                            wbAccountId: data.account.id,
                            kizUnitId: quarantineKizId,
                          }),
                          'Возврат принят в доступный остаток',
                        )
                      }
                    >
                      Пригоден
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Повреждение или утрата</CardTitle>
              <CardDescription>КИЗ исключается из доступного остатка; автоматического возврата в продажу нет.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <Select value={exceptionKizId} onValueChange={setExceptionKizId}>
                <SelectTrigger><SelectValue placeholder="КИЗ на складе" /></SelectTrigger>
                <SelectContent>
                  {data.kizUnits.filter((unit) => unit.physicalState === 'IN_STOCK').map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={exceptionNote} onChange={(event) => setExceptionNote(event.target.value)} placeholder="Причина" />
              <Button
                variant="outline"
                disabled={!exceptionKizId || !exceptionNote || !data.permissions.canOperate || pending}
                onClick={() =>
                  run(
                    () => markKizExceptionAction({
                      wbAccountId: data.account.id,
                      kizUnitId: exceptionKizId,
                      reason: 'damaged',
                      note: exceptionNote,
                    }),
                    'КИЗ помещён в карантин',
                  )
                }
              >
                Повреждён
              </Button>
              <Button
                variant="destructive"
                disabled={!exceptionKizId || !exceptionNote || !data.permissions.canOperate || pending}
                onClick={() => {
                  if (!window.confirm('Зафиксировать утрату КИЗа и исключить единицу из остатка?')) return
                  run(
                    () => markKizExceptionAction({
                      wbAccountId: data.account.id,
                      kizUnitId: exceptionKizId,
                      reason: 'lost',
                      note: exceptionNote,
                    }),
                    'Утрата КИЗа зафиксирована',
                  )
                }}
              >
                Утрачен
              </Button>
            </CardContent>
          </Card>

          <FilterBar
            query={kizQuery}
            onQueryChange={setKizQuery}
            placeholder="КИЗ, GTIN, артикул, склад или заказ"
          >
            <Select value={kizFilter} onValueChange={setKizFilter}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все КИЗы</SelectItem>
                <SelectItem value="IN_STOCK">Физически на складе</SelectItem>
                <SelectItem value="RESERVED">В резерве</SelectItem>
                <SelectItem value="HANDED_OVER">Переданы WB</SelectItem>
                <SelectItem value="RETURN_EXPECTED">Ожидается возврат</SelectItem>
                <SelectItem value="QUARANTINE">В карантине</SelectItem>
                <SelectItem value="UNKNOWN">Статус в ЧЗ не указан</SelectItem>
                <SelectItem value="IN_CIRCULATION">В обороте</SelectItem>
                <SelectItem value="WITHDRAWAL_REQUIRED">Требуется вывод</SelectItem>
                <SelectItem value="WITHDRAWN">Выведены из оборота</SelectItem>
                <SelectItem value="RETURN_TO_CIRCULATION_REQUIRED">Требуется возврат в оборот</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <DataTable>
            <TableHeader>
              <TableRow>
                <SortableHead label="КИЗ" sortKey="code" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="GTIN" sortKey="gtin" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Артикул" sortKey="vendorCode" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Склад" sortKey="warehouseName" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Физический статус" sortKey="physicalState" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Оборот" sortKey="circulationState" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Проверка WB" sortKey="wbValidationStatus" sort={kizSort} onSort={setKizSort} />
                <SortableHead label="Заказ WB" sortKey="externalOrderId" sort={kizSort} onSort={setKizSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kizHistory.rows.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono text-xs">{unit.code}</TableCell>
                  <TableCell>{unit.gtin ?? '—'}</TableCell><TableCell>{unit.vendorCode ?? '—'}</TableCell>
                  <TableCell>{unit.warehouseName ?? '—'}</TableCell>
                  <TableCell>{PHYSICAL_LABELS[unit.physicalState] ?? unit.physicalState}</TableCell>
                  <TableCell>{CIRCULATION_LABELS[unit.circulationState] ?? unit.circulationState}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        unit.wbValidationStatus && unit.wbValidationStatus !== 'VALID'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {unit.wbValidationStatus
                        ? WB_KIZ_VALIDATION_LABELS[unit.wbValidationStatus] ?? unit.wbValidationStatus
                        : 'Не проверялся'}
                    </Badge>
                  </TableCell>
                  <TableCell>{unit.externalOrderId ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!kizHistory.rows.length && <EmptyRow colSpan={8} text={data.rowCounts.kizUnits ? 'КИЗы по фильтру не найдены.' : 'КИЗы ещё не зарегистрированы.'} />}
            </TableBody>
          </DataTable>
          <ServerTablePager table={kizHistory} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Ручная очередь Честного знака</CardTitle>
              <CardDescription>
                Задача вывода создаётся после передачи заказа WB, а не при его создании и не
                после выкупа. Невыкупленный товар после фактического вывода возвращается в
                оборот только после физического возврата и проверки КИЗа.
                Состояние оборота хранится локально: сама выгрузка меняет статус задачи на
                «экспортирована», а статус КИЗа меняется массово после подтверждения принятого
                документа. Файл вывода содержит фактическую цену заказа WB за единицу;
                при вашем НДС 0% никакая надбавка к ней не применяется. Прямой онлайн-проверки
                статуса в Честном знаке пока нет.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
                  disabled={!data.permissions.canOperate || pending}
                  onClick={() => exportCompliance('WITHDRAWAL', 'Выгружено КИЗов на вывод')}
                >
                  <Download className="mr-2 h-4 w-4" /> Выгрузить на вывод из оборота
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-11 w-full whitespace-normal sm:w-auto"
                  disabled={!data.permissions.canOperate || pending}
                  onClick={() =>
                    exportCompliance(
                      'RETURN_TO_CIRCULATION',
                      'Выгружено КИЗов на возврат в оборот',
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" /> Выгрузить на возврат в оборот
                </Button>
              </div>
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label>Массовое подтверждение выгруженного файла</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    После успешной обработки XLSX в Честном знаке выберите файл и укажите один
                    подписанный документ для всех входящих в него КИЗов. В форме ЧЗ обязательны
                    только поля со звёздочкой. Поля блока «Первичный документ» на вашем экране без
                    звёздочек можно оставить пустыми. После подписания скопируйте номер или ID
                    документа из раздела «Документы» ЧЗ сюда — придумывать случайные значения не нужно.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_1fr_180px_auto]">
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger><SelectValue placeholder="Выгруженный файл" /></SelectTrigger>
                    <SelectContent>
                      {data.operationBatches.filter((batch) => batch.pendingCount > 0).map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.filename} · {batch.pendingCount} КИЗ
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={batchDocumentNumber}
                    onChange={(event) => setBatchDocumentNumber(event.target.value)}
                    placeholder="Номер или ID подписанного документа из ЧЗ"
                  />
                  <Input
                    type="date"
                    value={batchDocumentDate}
                    onChange={(event) => setBatchDocumentDate(event.target.value)}
                  />
                  <Button
                    disabled={
                      !selectedBatchId ||
                      !batchDocumentNumber ||
                      !batchDocumentDate ||
                      !data.permissions.canOperate ||
                      pending
                    }
                    onClick={confirmComplianceBatch}
                  >
                    Подтвердить весь файл
                  </Button>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <Label>Точечное подтверждение (для исключений)</Label>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger><SelectValue placeholder="Операция" /></SelectTrigger>
                    <SelectContent>
                      {data.complianceTasks.filter((task) => task.status !== 'CONFIRMED').map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {TASK_LABELS[task.type] ?? task.type} · {task.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Номер или ID подписанного документа из ЧЗ" />
                  <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
                  <Button
                    disabled={!selectedTaskId || !documentNumber || !data.permissions.canOperate || pending}
                    onClick={() =>
                      run(
                        () => confirmKizComplianceTaskAction({
                          wbAccountId: data.account.id,
                          taskId: selectedTaskId,
                          documentNumber,
                          documentDate,
                        }),
                        'Операция ЧЗ подтверждена',
                      )
                    }
                  >
                    Подтвердить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <FilterBar
            query={complianceQuery}
            onQueryChange={setComplianceQuery}
            placeholder="КИЗ, заказ, операция или документ"
          >
            <Select value={complianceFilter} onValueChange={setComplianceFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все операции</SelectItem>
                <SelectItem value="OPEN">Открытые</SelectItem>
                <SelectItem value="EXPORTED">Экспортированные</SelectItem>
                <SelectItem value="CONFIRMED">Подтверждённые</SelectItem>
                <SelectItem value="CANCELED">Отменённые</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <DataTable>
            <TableHeader>
              <TableRow>
                <SortableHead label="Операция" sortKey="type" sort={complianceSort} onSort={setComplianceSort} />
                <SortableHead label="КИЗ" sortKey="code" sort={complianceSort} onSort={setComplianceSort} />
                <SortableHead label="Заказ" sortKey="externalOrderId" sort={complianceSort} onSort={setComplianceSort} />
                <SortableHead label="Статус" sortKey="status" sort={complianceSort} onSort={setComplianceSort} />
                <SortableHead label="Документ" sortKey="documentNumber" sort={complianceSort} onSort={setComplianceSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {complianceHistory.rows.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{TASK_LABELS[task.type] ?? task.type}</TableCell>
                  <TableCell className="font-mono text-xs">{task.code}</TableCell>
                  <TableCell>{task.externalOrderId ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={task.status === 'CONFIRMED' ? 'default' : 'secondary'}
                    >
                      {getKizComplianceStatusLabel(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.documentNumber ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!complianceHistory.rows.length && <EmptyRow colSpan={5} text={data.rowCounts.complianceTasks ? 'Операции по фильтру не найдены.' : 'Операций ЧЗ нет.'} />}
            </TableBody>
          </DataTable>
          <ServerTablePager table={complianceHistory} />
        </TabsContent>

        <TabsContent value="supplies" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Перемещение заказа в поставку</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger><SelectValue placeholder="Заказ" /></SelectTrigger>
                <SelectContent>{data.orders.map((order) => <SelectItem key={order.id} value={order.id}>{order.externalOrderId}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedSupplyId} onValueChange={setSelectedSupplyId}>
                <SelectTrigger><SelectValue placeholder="Открытая поставка" /></SelectTrigger>
                <SelectContent>{data.supplies.filter((supply) => !supply.done).map((supply) => <SelectItem key={supply.id} value={supply.id}>{supply.name ?? supply.externalId}</SelectItem>)}</SelectContent>
              </Select>
              <Button
                disabled={!selectedOrderId || !selectedSupplyId || !data.permissions.canOperate || pending}
                onClick={() =>
                  run(
                    () => moveOrderToFbsSupplyAction({
                      wbAccountId: data.account.id,
                      orderId: selectedOrderId,
                      supplyId: selectedSupplyId,
                    }),
                    'Заказ перенесён в поставку',
                  )
                }
              >
                Перенести
              </Button>
            </CardContent>
          </Card>
          <FilterBar
            query={supplyQuery}
            onQueryChange={setSupplyQuery}
            placeholder="Поставка, WB ID или склад"
          >
            <Select value={supplyFilter} onValueChange={setSupplyFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все поставки</SelectItem>
                <SelectItem value="OPEN">Открытые</SelectItem>
                <SelectItem value="CLOSED">Закрытые</SelectItem>
                <SelectItem value="B2B">Только B2B</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <MobileSortControls
            value={supplySort.key}
            direction={supplySort.direction}
            options={SUPPLY_SORT_OPTIONS}
            onFieldChange={(key) => setSupplySort(nextSort(supplySort, key))}
            onDirectionToggle={() => setSupplySort(nextSort(supplySort, supplySort.key))}
            className="lg:hidden"
          />
          <div className="grid gap-3 lg:hidden">
            {supplyHistory.rows.map((supply) => (
              <article key={supply.id} className="rounded-md border bg-card p-3 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{supply.name ?? supply.externalId}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{supply.warehouseName ?? 'Склад не указан'}</p>
                  </div>
                  <Badge variant={supply.done ? 'secondary' : 'outline'}>{supply.done ? 'Закрыта' : 'Открыта'}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MobileField label="Заказов" value={formatNumber(supply.orderCount)} />
                  <MobileField label="Тип" value={supply.isB2b ? 'B2B' : 'Обычная'} />
                </div>
                {!supply.done && (
                  <Button
                    className="mt-3 w-full"
                    variant="destructive"
                    disabled={!data.permissions.canOperate || pending}
                    onClick={() => {
                      if (!window.confirm('Закрыть поставку в WB? Действие нельзя отменить.')) return
                      run(
                        () => closeFbsSupplyInWbAction({ wbAccountId: data.account.id, supplyId: supply.id }),
                        'Поставка закрыта',
                      )
                    }}
                  >
                    Закрыть поставку
                  </Button>
                )}
              </article>
            ))}
            {!supplyHistory.rows.length && (
              <MobileEmpty text={data.rowCounts.supplies ? 'Поставки по фильтру не найдены.' : 'Поставки ещё не синхронизированы.'} />
            )}
          </div>
          <DataTable className="hidden lg:block">
            <TableHeader>
              <TableRow>
                <SortableHead label="Поставка" sortKey="name" sort={supplySort} onSort={setSupplySort} />
                <SortableHead label="Склад" sortKey="warehouseName" sort={supplySort} onSort={setSupplySort} />
                <SortableHead label="Заказов" sortKey="orderCount" sort={supplySort} onSort={setSupplySort} />
                <SortableHead label="B2B" sortKey="isB2b" sort={supplySort} onSort={setSupplySort} />
                <SortableHead label="Статус" sortKey="done" sort={supplySort} onSort={setSupplySort} />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplyHistory.rows.map((supply) => (
                <TableRow key={supply.id}>
                  <TableCell className="font-medium">{supply.name ?? supply.externalId}</TableCell>
                  <TableCell>{supply.warehouseName ?? '—'}</TableCell><TableCell>{supply.orderCount}</TableCell>
                  <TableCell>{supply.isB2b ? 'Да' : 'Нет'}</TableCell>
                  <TableCell><Badge variant={supply.done ? 'secondary' : 'outline'}>{supply.done ? 'Закрыта' : 'Открыта'}</Badge></TableCell>
                  <TableCell>
                    {!supply.done && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!data.permissions.canOperate || pending}
                        onClick={() => {
                          if (!window.confirm('Закрыть поставку в WB? Действие нельзя отменить.')) return
                          run(
                            () => closeFbsSupplyInWbAction({ wbAccountId: data.account.id, supplyId: supply.id }),
                            'Поставка закрыта',
                          )
                        }}
                      >
                        Закрыть
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!supplyHistory.rows.length && <EmptyRow colSpan={6} text={data.rowCounts.supplies ? 'Поставки по фильтру не найдены.' : 'Поставки ещё не синхронизированы.'} />}
            </TableBody>
          </DataTable>
          <ServerTablePager table={supplyHistory} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">FBS-аналитика</CardTitle>
              <CardDescription>
                Заказы и отмены — по дате заказа. Выкупы, возвраты и суммы — по дате
                финансовой операции WB. ОП FBS учитывает перечисление, прямые расходы WB,
                себестоимость и налог; общая реклама между FBS и FBO здесь не распределяется.
                Маржинальность — ОП к выручке, рентабельность — ОП к совокупным затратам,
                процент выкупа — чистые выкупы к завершённым исходам (выкупы плюс отмены).
                Период применяется только к этому блоку.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                <DateRangePicker
                  value={analyticsRange}
                  className="w-full min-w-0 sm:w-auto"
                  onChange={(range) => {
                    if (range.from) setAnalyticsFrom(formatDateValue(range.from))
                    if (range.to) setAnalyticsTo(formatDateValue(range.to))
                  }}
                />
                <Button className="w-full sm:w-auto" variant="outline" onClick={applyPeriod}>Применить</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Metric label="Заказы FBS" value={formatNumber(data.metrics.fbsOrders)} />
                <Metric label="Отмены FBS" value={formatNumber(data.metrics.fbsCancellations)} warning={data.metrics.fbsCancellations > 0} />
                <Metric label="Выкупы FBS" value={formatNumber(data.metrics.fbsSales)} />
                <Metric label="Возвраты FBS" value={formatNumber(data.metrics.fbsReturns)} warning={data.metrics.fbsReturns > 0} />
                <Metric label="Выручка FBS" value={formatRub(Number(data.metrics.fbsRevenue))} />
                <Metric label="К перечислению FBS" value={formatRub(Number(data.metrics.fbsToTransfer))} />
              </div>
            </CardContent>
          </Card>
          <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(240px,0.7fr)_repeat(4,minmax(0,1fr))]">
            <FilterBar
              query={analyticsQuery}
              onQueryChange={setAnalyticsQuery}
              placeholder="Артикул или nmId"
              className="h-full"
            />
            <Metric label="ОП FBS" value={formatRub(Number(data.metrics.fbsOperatingProfit))} warning={Number(data.metrics.fbsOperatingProfit) < 0} />
            <Metric label="Общая маржинальность" value={formatPercent(Number(data.metrics.fbsMarginality))} warning={Number(data.metrics.fbsMarginality) < 0} />
            <Metric label="Рентабельность FBS" value={formatPercent(Number(data.metrics.fbsProfitability))} warning={Number(data.metrics.fbsProfitability) < 0} />
            <Metric label="Процент выкупа FBS" value={formatPercent(Number(data.metrics.fbsBuyoutPercent))} />
          </div>
          <DataTable>
            <TableHeader>
              <TableRow>
                <SortableHead label="Артикул" sortKey="vendorCode" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="nmId" sortKey="nmId" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Заказы" sortKey="orders" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Отмены" sortKey="cancellations" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Выкупы" sortKey="sales" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Возвраты" sortKey="returns" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Выручка" sortKey="revenue" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="К перечислению" sortKey="toTransfer" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="ОП FBS" sortKey="operatingProfit" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Маржинальность" sortKey="marginality" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="Рентабельность" sortKey="profitability" sort={analyticsSort} onSort={setAnalyticsSort} />
                <SortableHead label="% выкупа" sortKey="buyoutPercent" sort={analyticsSort} onSort={setAnalyticsSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyticsView.rows.map((row) => (
                <TableRow key={`${row.nmId}-${row.vendorCode}`}>
                  <TableCell className="font-medium">{row.vendorCode}</TableCell>
                  <TableCell>{row.nmId}</TableCell>
                  <TableCell>{row.orders}</TableCell>
                  <TableCell>{row.cancellations}</TableCell>
                  <TableCell>{row.sales}</TableCell>
                  <TableCell>{row.returns}</TableCell>
                  <TableCell>{formatRub(Number(row.revenue))}</TableCell>
                  <TableCell>{formatRub(Number(row.toTransfer))}</TableCell>
                  <TableCell>{formatRub(Number(row.operatingProfit))}</TableCell>
                  <TableCell>{formatPercent(Number(row.marginality))}</TableCell>
                  <TableCell>{formatPercent(Number(row.profitability))}</TableCell>
                  <TableCell>{formatPercent(Number(row.buyoutPercent))}</TableCell>
                </TableRow>
              ))}
              {!filteredFinanceByArticle.length && <EmptyRow colSpan={12} text={data.financeByArticle.length ? 'Артикулы по фильтру не найдены.' : 'За период нет заказов или финансовых операций FBS.'} />}
            </TableBody>
          </DataTable>
          <TablePager view={analyticsView} loadedCount={data.financeByArticle.length} totalCount={data.rowCounts.financeByArticle} />
          <Card>
            <CardHeader><CardTitle className="text-base">Последние записи в WB</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <FilterBar
                query={actionQuery}
                onQueryChange={setActionQuery}
                placeholder="Действие, статус, дата или ошибка"
              />
              {actionHistory.rows.map((action) => (
                <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>
                    {getFbsActionKindLabel(action.kind)} · {formatDate(action.createdAt)}
                  </span>
                  <Badge
                    variant={action.status === 'SUCCEEDED' ? 'default' : action.status === 'FAILED' ? 'destructive' : 'secondary'}
                  >
                    {getFbsActionStatusLabel(action.status)}
                  </Badge>
                  {action.error && <span className="basis-full text-xs text-destructive">{action.error}</span>}
                </div>
              ))}
              {!actionHistory.rows.length && <Empty text={data.rowCounts.recentActions ? 'Записи по фильтру не найдены.' : 'Записей в WB ещё не было.'} />}
              <ServerTablePager table={actionHistory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

type SortValue = string | number | boolean | null | undefined

function useFbsServerTable<T extends FbsHistoryRow>({
  wbAccountId,
  section,
  initialRows,
  initialTotal,
  query,
  filter,
  sort,
  dateRange,
}: {
  wbAccountId: string
  section: FbsHistorySection
  initialRows: T[]
  initialTotal: number
  query: string
  filter: string
  sort: TableSort
  dateRange: DateRange
}) {
  const [state, setState] = useState({
    rows: initialRows.slice(0, 25),
    total: initialTotal,
    page: 1,
    pageSize: 25,
    loading: false,
  })
  const requestId = useRef(0)

  const load = useCallback(async (page: number, pageSize: number) => {
    const currentRequest = ++requestId.current
    setState((current) => ({ ...current, loading: true }))
    const result = await getFbsHistoryPageAction({
      wbAccountId,
      section,
      query,
      filter,
      sortKey: sort.key,
      sortDirection: sort.direction,
      page,
      pageSize,
      dateFrom: dateRange.from ? formatDateValue(dateRange.from) : undefined,
      dateTo: dateRange.to ? formatDateValue(dateRange.to) : undefined,
    })
    if (currentRequest !== requestId.current) return
    if (!result.success) {
      toast.error(result.error)
      setState((current) => ({ ...current, loading: false }))
      return
    }
    setState({
      rows: result.data.rows as T[],
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      loading: false,
    })
  }, [dateRange.from, dateRange.to, filter, query, section, sort.direction, sort.key, wbAccountId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1, state.pageSize), 300)
    return () => window.clearTimeout(timer)
  }, [load, state.pageSize])

  return {
    ...state,
    pageCount: Math.max(1, Math.ceil(state.total / state.pageSize)),
    from: state.total ? (state.page - 1) * state.pageSize + 1 : 0,
    to: Math.min(state.page * state.pageSize, state.total),
    setPage: (page: number) => void load(page, state.pageSize),
    setPageSize: (pageSize: number) => void load(1, pageSize),
  }
}

function useTableView<T>(
  rows: T[],
  sort: TableSort,
  getValue: (row: T, key: string) => SortValue,
  pageSize = 25,
) {
  const [page, setPage] = useState(1)
  const sortedRows = useMemo(() => [...rows].sort((left, right) => {
    const comparison = compareSortValues(getValue(left, sort.key), getValue(right, sort.key))
    return sort.direction === 'asc' ? comparison : -comparison
  }), [getValue, rows, sort.direction, sort.key])
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))

  useEffect(() => setPage(1), [rows, sort.direction, sort.key])
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount])

  const safePage = Math.min(page, pageCount)
  const from = sortedRows.length ? (safePage - 1) * pageSize + 1 : 0
  const to = Math.min(safePage * pageSize, sortedRows.length)

  return {
    rows: sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    filteredCount: sortedRows.length,
    page: safePage,
    pageCount,
    from,
    to,
    setPage,
  }
}

function compareSortValues(left: SortValue, right: SortValue) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right)
  return String(left).localeCompare(String(right), 'ru', { numeric: true, sensitivity: 'base' })
}

function nextSort(current: TableSort, key: string): TableSort {
  return current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: 'asc' }
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: string
  sort: TableSort
  onSort: (sort: TableSort) => void
}) {
  return (
    <TableHead aria-sort={sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap font-medium hover:text-foreground md:min-h-0"
        onClick={() => onSort(nextSort(sort, sortKey))}
      >
        {label}
        <ChevronsUpDown className={`h-3.5 w-3.5 ${sort.key === sortKey ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </TableHead>
  )
}

function TablePager({
  view,
  loadedCount,
  totalCount,
}: {
  view: ReturnType<typeof useTableView<unknown>>
  loadedCount: number
  totalCount: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span>
        Строк: {view.filteredCount}. Показано {view.from}–{view.to}.
        {totalCount > loadedCount ? ` Загружено для работы ${loadedCount} из ${totalCount}.` : ` Всего: ${totalCount}.`}
      </span>
      {view.pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={view.page <= 1} onClick={() => view.setPage(view.page - 1)}>Назад</Button>
          <span>{view.page} / {view.pageCount}</span>
          <Button size="sm" variant="outline" disabled={view.page >= view.pageCount} onClick={() => view.setPage(view.page + 1)}>Вперёд</Button>
        </div>
      )}
    </div>
  )
}

function ServerTablePager({ table }: { table: {
  total: number
  page: number
  pageSize: number
  pageCount: number
  from: number
  to: number
  loading: boolean
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
} }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
      <span>{table.loading ? 'Загрузка…' : `Показано ${table.from}–${table.to} из ${table.total}`}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(table.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 строк</SelectItem>
            <SelectItem value="50">50 строк</SelectItem>
            <SelectItem value="100">100 строк</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={table.loading || table.page <= 1} onClick={() => table.setPage(table.page - 1)}>Назад</Button>
        <span>{table.page} / {table.pageCount}</span>
        <Button size="sm" variant="outline" disabled={table.loading || table.page >= table.pageCount} onClick={() => table.setPage(table.page + 1)}>Вперёд</Button>
      </div>
    </div>
  )
}

function assortmentSortValue(row: FbsWorkspaceData['assortment'][number], key: string): SortValue {
  return ({
    warehouseName: row.warehouseName,
    vendorCode: row.vendorCode ?? row.barcode,
    chrtId: row.chrtId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
    wbStock: row.wbStock,
    marking: row.requiresKiz,
  } satisfies Record<string, SortValue>)[key]
}

function analyticsSortValue(row: FbsWorkspaceData['financeByArticle'][number], key: string): SortValue {
  return ({
    vendorCode: row.vendorCode,
    nmId: row.nmId,
    orders: row.orders,
    cancellations: row.cancellations,
    sales: row.sales,
    returns: row.returns,
    revenue: Number(row.revenue),
    toTransfer: Number(row.toTransfer),
    operatingProfit: Number(row.operatingProfit),
    marginality: Number(row.marginality),
    profitability: Number(row.profitability),
    buyoutPercent: Number(row.buyoutPercent),
  } satisfies Record<string, SortValue>)[key]
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="old-money-panel rounded-md p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="metric-label">{label}</p>
        {warning ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <PackageCheck className="h-4 w-4 text-primary" />}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Exception({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${value > 0 ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  )
}

function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-x-auto rounded-md border bg-card ${className ?? ''}`}><Table className="min-w-[900px]">{children}</Table></div>
}

function MobileField({
  label,
  value,
  emphasized = false,
  warning = false,
}: {
  label: string
  value: React.ReactNode
  emphasized?: boolean
  warning?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md border bg-secondary/25 px-2.5 py-2">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <div className={`mt-1 break-words text-sm tabular-nums ${emphasized ? 'font-semibold' : ''} ${warning ? 'text-destructive' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function MobileEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

type SortDirection = 'asc' | 'desc'
type TableSort = { key: string; direction: SortDirection }

function FilterBar({
  query,
  onQueryChange,
  placeholder,
  children,
  className,
}: {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row ${className ?? ''}`}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {children}
    </div>
  )
}

function ItemSelect({
  items,
  value,
  onChange,
}: {
  items: FbsWorkspaceData['assortment']
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Артикул FBS" /></SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.warehouseName} · {item.vendorCode ?? item.barcode} · {item.chrtId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CatalogCandidateSelect({
  items,
  value,
  onChange,
}: {
  items: FbsWorkspaceData['catalogCandidates']
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selected = items.find((item) => item.productSizeId === value)
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = normalizedSearch
    ? items.filter((item) =>
        [
          item.vendorCode,
          item.size,
          item.barcode,
          String(item.nmId),
          String(item.chrtId),
        ].some((field) => field.toLowerCase().includes(normalizedSearch)),
      )
    : items

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className={`truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selected
              ? `${selected.vendorCode} · ${selected.size} · chrtId ${selected.chrtId}`
              : 'Артикул и размер'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="flex w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0"
        style={{
          maxHeight:
            'min(calc(100dvh - 1rem), var(--radix-popover-content-available-height))',
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
          }
        }}
      >
        <div className="shrink-0 border-b p-2">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по артикулу, размеру, barcode или chrtId"
            className="h-11 text-base lg:h-9 lg:text-sm"
          />
        </div>
        <div
          className="max-h-80 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
          onWheel={(event) => event.stopPropagation()}
        >
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.productSizeId}
                type="button"
                className="flex min-h-11 w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => {
                  onChange(item.productSizeId)
                  setOpen(false)
                  setSearch('')
                }}
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${item.productSizeId === value ? 'opacity-100' : 'opacity-0'}`}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.vendorCode} · {item.size}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    chrtId {item.chrtId} · barcode {item.barcode}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <TableRow><TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">{text}</TableCell></TableRow>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value)
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + '%'
}

function parseDateValue(value: string) {
  return value ? new Date(`${value}T12:00:00`) : undefined
}

function formatDateValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function matchesSearch(query: string, ...values: Array<string | number | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
