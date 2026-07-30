'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  confirmKizComplianceTaskAction,
  exportKizComplianceTasksAction,
  getFbsSyncJobStatusAction,
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
import {
  FBS_STATUS_ACTION_LABELS,
  getFbsSupplierStatusLabel,
  getFbsWbStatusLabel,
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
  UNKNOWN: 'Не определён',
  COMMISSIONING_REQUIRED: 'Нужен ввод',
  IN_CIRCULATION: 'В обороте',
  WITHDRAWAL_REQUIRED: 'Нужно выбытие',
  WITHDRAWN: 'Выведен',
  RETURN_TO_CIRCULATION_REQUIRED: 'Нужен возврат в оборот',
}

const WB_KIZ_VALIDATION_LABELS: Record<string, string> = {
  VALID: 'Получен из WB',
  GTIN_MISMATCH: 'Не совпадает GTIN',
  ORDER_CONFLICT: 'КИЗ в другом заказе',
  STATE_CONFLICT: 'Конфликт состояния',
}

const TASK_LABELS: Record<string, string> = {
  COMMISSIONING: 'Ввод в оборот',
  WITHDRAWAL_REMOTE_SALE: 'Вывод: дистанционная продажа',
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
  const [analyticsFrom, setAnalyticsFrom] = useState(dateFrom)
  const [analyticsTo, setAnalyticsTo] = useState(dateTo)
  const fileRef = useRef<HTMLInputElement>(null)

  const availableKiz = useMemo(
    () => data.kizUnits.filter((unit) => ['IN_STOCK', 'RESERVED'].includes(unit.physicalState)),
    [data.kizUnits],
  )

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

  async function exportCompliance() {
    startTransition(async () => {
      const result = await exportKizComplianceTasksAction({ wbAccountId: data.account.id })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      downloadBase64(result.data.base64, result.data.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      toast.success(`Выгружено операций: ${result.data.taskCount}`)
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
        <div className="flex flex-wrap gap-2">
          <Select value={data.account.id} onValueChange={switchAccount}>
            <SelectTrigger className="w-56">
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

      <Tabs defaultValue="orders" className="min-w-0">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Сводка</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="warehouse">Свой склад</TabsTrigger>
          <TabsTrigger value="kiz">КИЗы</TabsTrigger>
          <TabsTrigger value="compliance">Честный знак</TabsTrigger>
          <TabsTrigger value="supplies">Поставки</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Склады продавца</CardTitle>
              <CardDescription>NimbaOS — источник локального остатка; WB показывается для сверки.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.warehouses.map((warehouse) => (
                <div key={warehouse.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-xs text-muted-foreground">WB ID {warehouse.externalId}</p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>Локально доступно: <b>{warehouse.available}</b> · Остаток WB: <b>{warehouse.wbStock}</b></p>
                    <Badge variant={warehouse.writeEnabled ? 'destructive' : 'secondary'}>
                      {warehouse.writeEnabled ? 'Операции в WB разрешены' : 'WB только чтение'}
                    </Badge>
                  </div>
                </div>
              ))}
              {!data.warehouses.length && <Empty text="Запустите синхронизацию FBS, чтобы загрузить склады." />}
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
                    <SelectItem key={unit.id} value={unit.id}>{unit.maskedCode}</SelectItem>
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

          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ WB</TableHead><TableHead>Создан</TableHead><TableHead>Артикул</TableHead>
                <TableHead>Склад</TableHead><TableHead>Статусы</TableHead><TableHead>КИЗ</TableHead>
                <TableHead>Метаданные WB</TableHead><TableHead>Стикер</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.externalOrderId}</TableCell>
                  <TableCell>{formatDate(order.createdAtWb)}</TableCell>
                  <TableCell>{order.vendorCode ?? order.barcode}</TableCell>
                  <TableCell>{order.warehouseName ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        title={`Статус продавца: ${order.supplierStatus}`}
                      >
                        Продавец: {getFbsSupplierStatusLabel(order.supplierStatus)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        title={`Статус WB: ${order.wbStatus}`}
                      >
                        WB: {getFbsWbStatusLabel(order.wbStatus)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{order.kizMasked ?? (order.requiresKiz ? <Badge variant="destructive">Нужен КИЗ</Badge> : '—')}</TableCell>
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
              {!data.orders.length && <EmptyRow colSpan={8} text="Заказы FBS ещё не синхронизированы." />}
            </TableBody>
          </DataTable>
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

          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Склад</TableHead><TableHead>Артикул</TableHead><TableHead>chrtId</TableHead>
                <TableHead>Физически на складе</TableHead><TableHead>Резерв заказов</TableHead><TableHead>Доступно локально</TableHead>
                <TableHead>Остаток WB</TableHead><TableHead>Маркировка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assortment.map((item) => (
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
                      className="text-left"
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
              {!data.assortment.length && <EmptyRow colSpan={8} text="FBS-артикулы появятся после загрузки заказов." />}
            </TableBody>
          </DataTable>

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
                  <div className="flex gap-2">
                    {data.permissions.canEnableWbWrites && (
                      <Button
                        variant="outline"
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
                    <SelectItem value="UNKNOWN">Статус оборота не определён</SelectItem>
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
                  <div className="mt-2 flex gap-2">
                    <Input value={returnKizCode} onChange={(event) => setReturnKizCode(event.target.value)} placeholder="Отсканируйте возвратный КИЗ" />
                    <Button
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
                  <div className="mt-3 flex gap-2">
                    <Select value={quarantineKizId} onValueChange={setQuarantineKizId}>
                      <SelectTrigger><SelectValue placeholder="КИЗ после осмотра" /></SelectTrigger>
                      <SelectContent>
                        {data.kizUnits.filter((unit) => unit.physicalState === 'QUARANTINE').map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>{unit.maskedCode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
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
                    <SelectItem key={unit.id} value={unit.id}>{unit.maskedCode}</SelectItem>
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

          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>КИЗ</TableHead><TableHead>GTIN</TableHead><TableHead>Артикул</TableHead>
                <TableHead>Склад</TableHead><TableHead>Физический статус</TableHead>
                <TableHead>Оборот</TableHead><TableHead>Проверка WB</TableHead><TableHead>Заказ WB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.kizUnits.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono text-xs">{unit.maskedCode}</TableCell>
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
              {!data.kizUnits.length && <EmptyRow colSpan={8} text="КИЗы ещё не зарегистрированы." />}
            </TableBody>
          </DataTable>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Ручная очередь Честного знака</CardTitle>
              <CardDescription>Этап 1: выгрузка XLSX и подтверждение документа после операции в Честном знаке.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button disabled={!data.permissions.canOperate || pending} onClick={exportCompliance}>
                <Download className="mr-2 h-4 w-4" /> Выгрузить открытые операции
              </Button>
              <div className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_1fr_180px_auto]">
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger><SelectValue placeholder="Операция" /></SelectTrigger>
                  <SelectContent>
                    {data.complianceTasks.filter((task) => task.status !== 'CONFIRMED').map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {TASK_LABELS[task.type] ?? task.type} · {task.maskedCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Номер документа ЧЗ" />
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
            </CardContent>
          </Card>
          <DataTable>
            <TableHeader>
              <TableRow><TableHead>Операция</TableHead><TableHead>КИЗ</TableHead><TableHead>Заказ</TableHead><TableHead>Статус</TableHead><TableHead>Документ</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.complianceTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{TASK_LABELS[task.type] ?? task.type}</TableCell>
                  <TableCell className="font-mono text-xs">{task.maskedCode}</TableCell>
                  <TableCell>{task.externalOrderId ?? '—'}</TableCell>
                  <TableCell><Badge variant={task.status === 'CONFIRMED' ? 'default' : 'secondary'}>{task.status}</Badge></TableCell>
                  <TableCell>{task.documentNumber ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!data.complianceTasks.length && <EmptyRow colSpan={5} text="Открытых операций нет." />}
            </TableBody>
          </DataTable>
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
          <DataTable>
            <TableHeader>
              <TableRow><TableHead>Поставка</TableHead><TableHead>Склад</TableHead><TableHead>Заказов</TableHead><TableHead>B2B</TableHead><TableHead>Статус</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {data.supplies.map((supply) => (
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
              {!data.supplies.length && <EmptyRow colSpan={6} text="Поставки ещё не синхронизированы." />}
            </TableBody>
          </DataTable>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">FBS-продажи по финансовому отчёту</CardTitle>
              <CardDescription>Фильтр deliveryMethod=FBS. Период применяется только к этому блоку.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                <Input type="date" value={analyticsFrom} className="w-44" onChange={(event) => setAnalyticsFrom(event.target.value)} />
                <Input type="date" value={analyticsTo} className="w-44" onChange={(event) => setAnalyticsTo(event.target.value)} />
                <Button variant="outline" onClick={applyPeriod}>Применить</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="К перечислению FBS" value={formatRub(Number(data.metrics.fbsRevenue))} />
                <Metric label="Продажи FBS" value={formatNumber(data.metrics.fbsSales)} />
                <Metric label="Возвраты FBS" value={formatNumber(data.metrics.fbsReturns)} warning={data.metrics.fbsReturns > 0} />
              </div>
            </CardContent>
          </Card>
          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>Артикул</TableHead><TableHead>nmId</TableHead>
                <TableHead>Продажи</TableHead><TableHead>Возвраты</TableHead>
                <TableHead>К перечислению</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.financeByArticle.map((row) => (
                <TableRow key={`${row.nmId}-${row.vendorCode}`}>
                  <TableCell className="font-medium">{row.vendorCode}</TableCell>
                  <TableCell>{row.nmId}</TableCell>
                  <TableCell>{row.sales}</TableCell>
                  <TableCell>{row.returns}</TableCell>
                  <TableCell>{formatRub(Number(row.revenue))}</TableCell>
                </TableRow>
              ))}
              {!data.financeByArticle.length && <EmptyRow colSpan={5} text="За период нет строк deliveryMethod=FBS." />}
            </TableBody>
          </DataTable>
          <Card>
            <CardHeader><CardTitle className="text-base">Последние записи в WB</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.recentActions.map((action) => (
                <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>{action.kind} · {formatDate(action.createdAt)}</span>
                  <Badge variant={action.status === 'SUCCEEDED' ? 'default' : action.status === 'FAILED' ? 'destructive' : 'secondary'}>{action.status}</Badge>
                  {action.error && <span className="basis-full text-xs text-destructive">{action.error}</span>}
                </div>
              ))}
              {!data.recentActions.length && <Empty text="Записей в WB ещё не было." />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
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

function DataTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-md border bg-card"><Table className="min-w-[900px]">{children}</Table></div>
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
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по артикулу, размеру, barcode или chrtId"
            className="h-9"
            autoFocus
          />
        </div>
        <div
          className="overflow-y-auto overscroll-contain p-1"
          style={{ maxHeight: 'min(20rem, 60vh)' }}
          onWheel={(event) => event.stopPropagation()}
        >
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.productSizeId}
                type="button"
                className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
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
