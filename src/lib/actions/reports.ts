'use server'

import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { enqueueReportsSyncAction } from '@/lib/actions/sync'
import { REPORT_COLUMN_ORDER_PREFERENCE_KEY } from '@/lib/reports/preferences'
import { calculateReport, REPORT_CALCULATION_OPTIONS } from '@/lib/services/report-calculator'
import {
  appendAoaSheet,
  createWorkbook,
  safeXlsxFilename,
  toExcelNumber,
  workbookToBase64,
} from '@/lib/xlsx/export'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'
import type { ReportData, ReportRow } from '@/types/reports'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

const REPORT_TEXT_FIELDS = new Set<keyof ReportRow>([
  'subjectName',
  'vendorCode',
  'brandName',
  'tags',
  'photoUrl',
])

// ── syncReportsAction ─────────────────────────────────────────────────────────

export async function syncReportsAction(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<EnqueuedSyncJob>> {
  return enqueueReportsSyncAction(wbAccountId, dateFrom, dateTo)
}

// ── getReportData ─────────────────────────────────────────────────────────────

export async function getReportData(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<ReportData>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }
    if (!dateFrom || !dateTo) return { success: false, error: 'Укажите период' }
    const data = await calculateReport(wbAccountId, dateFrom, dateTo, REPORT_CALCULATION_OPTIONS)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки отчёта' }
  }
}

export async function saveReportColumnOrder(
  columnOrder: string[],
): Promise<ActionResult<{ columnOrder: string[] }>> {
  try {
    const session = await requireSession()
    const cleaned = Array.from(new Set(columnOrder.filter((id) => typeof id === 'string' && id.length > 0)))

    await prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId: session.user.id,
          key: REPORT_COLUMN_ORDER_PREFERENCE_KEY,
        },
      },
      create: {
        userId: session.user.id,
        key: REPORT_COLUMN_ORDER_PREFERENCE_KEY,
        value: cleaned as Prisma.InputJsonValue,
      },
      update: {
        value: cleaned as Prisma.InputJsonValue,
      },
    })

    return { success: true, data: { columnOrder: cleaned } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось сохранить порядок столбцов' }
  }
}

// ── exportReportXlsx ──────────────────────────────────────────────────────────

export async function exportReportXlsx(
  wbAccountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ActionResult<{ base64: string; filename: string }>> {
  try {
    await requireSession()
    if (!wbAccountId) return { success: false, error: 'Кабинет не выбран' }

    const data = await calculateReport(wbAccountId, dateFrom, dateTo, REPORT_CALCULATION_OPTIONS)
    const allRows = [...data.rows, data.summary]

    const headers = [
      'nmId', 'subjectName', 'vendorCode', 'brandName',
      'sale', 'toTransfer', 'totalToPay', 'operatingProfit', 'operatingProfitUnit', 'operatingProfitShare', 'avgPrice',
      'boughtWithReturns', 'buyoutPercent', 'boughtWithoutReturns', 'returns',
      'marginality', 'rentability',
      'adBalance', 'adAll', 'drr',
      'logistics', 'logisticsUnit', 'delivered', 'logisticsFromSalesPercent',
      'externalAd', 'selfPurchaseCost', 'cashbackDistributions', 'selfPurchaseAmount',
      'storageFromSalesPercent', 'costPrice', 'storageFee', 'acceptance', 'additionalPayment',
      'penalty', 'taxes', 'commission', 'selfPurchases', 'acquiringFee',
      'cancellations',
      'salesReturnsNoSpp', 'salesWithSpp', 'returnsWithSpp', 'salesNoSpp', 'returnsNoSpp',
      'commissionOnSale', 'commissionOnReturn', 'deductions',
      'salesToTransfer', 'returnsToTransfer', 'acquiringOnSale', 'tags', 'acquiringOnReturn',
    ] as const satisfies readonly (keyof ReportRow)[]

    const headerLabels: Record<(typeof headers)[number], string> = {
      nmId: 'Артикул ВБ', subjectName: 'Категория', vendorCode: 'Артикул', brandName: 'Бренд',
      sale: 'Продажа', toTransfer: 'К перечислению', totalToPay: 'Итого к оплате',
      operatingProfit: 'ОП', operatingProfitUnit: 'ОП ед.', operatingProfitShare: '% от ОП', avgPrice: 'Цена ср.',
      boughtWithReturns: 'Выкуплено', buyoutPercent: 'Выкуп %', boughtWithoutReturns: 'Без возврата', returns: 'Возвраты',
      marginality: 'Маржинальность', rentability: 'Рентабельность',
      adBalance: 'Реклама (баланс)', adAll: 'Реклама (все)', drr: 'ДРР %',
      logistics: 'Логистика', logisticsUnit: 'Лог. ед.', delivered: 'Доставлено', logisticsFromSalesPercent: 'Лог. от продаж %',
      externalAd: 'Внешн. реклама', selfPurchaseCost: 'Себест. самовыкупов', cashbackDistributions: 'Кэшбек', selfPurchaseAmount: 'Сумма самовыкупов',
      storageFromSalesPercent: 'Хранение %', costPrice: 'Себестоимость', storageFee: 'Хранение',
      acceptance: 'Приёмка', additionalPayment: 'Доплаты', penalty: 'Штрафы', taxes: 'Налоги',
      commission: 'Комиссия', selfPurchases: 'Самовыкупы', acquiringFee: 'Эквайринг',
      cancellations: 'Отмены',
      salesReturnsNoSpp: 'Продажи-возвраты без СПП', salesWithSpp: 'Продажи с СПП',
      returnsWithSpp: 'Возвраты с СПП', salesNoSpp: 'Продажи без СПП', returnsNoSpp: 'Возвраты без СПП',
      commissionOnSale: 'Комиссия при продаже', commissionOnReturn: 'Комиссия при возврате',
      deductions: 'Удержания', salesToTransfer: 'Продажи к перечислению',
      returnsToTransfer: 'Возвраты к перечислению', acquiringOnSale: 'Эквайринг при продаже',
      tags: 'Ярлыки', acquiringOnReturn: 'Эквайринг при возврате',
    }

    const wsData = [
      headers.map((h) => headerLabels[h]),
      ...allRows.map((row) =>
        headers.map((h) => (REPORT_TEXT_FIELDS.has(h) ? row[h] ?? '' : toExcelNumber(row[h]))),
      ),
    ]

    const columnFormats: Record<number, string> = {}
    headers.forEach((h, idx) => {
      if (!REPORT_TEXT_FIELDS.has(h)) columnFormats[idx] = h === 'nmId' ? '0' : '#,##0.00'
    })

    const wb = createWorkbook()
    appendAoaSheet(wb, 'Отчёт', wsData, {
      widths: headers.map((h) => Math.min(Math.max(headerLabels[h].length + 2, 12), 28)),
      columnFormats,
    })

    const base64 = workbookToBase64(wb)
    const filename = safeXlsxFilename('report', dateFrom, dateTo)

    return { success: true, data: { base64, filename } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка экспорта' }
  }
}
