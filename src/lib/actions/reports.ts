'use server'

import { getServerSession } from 'next-auth'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth'
import { enqueueReportsSyncAction } from '@/lib/actions/sync'
import { calculateReport } from '@/lib/services/report-calculator'
import type { ActionResult } from '@/types'
import type { EnqueuedSyncJob } from '@/types/sync'
import type { ReportData, ReportRow } from '@/types/reports'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error('Не авторизован')
  return session
}

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
    const data = await calculateReport(wbAccountId, dateFrom, dateTo)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка загрузки отчёта' }
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

    const data = await calculateReport(wbAccountId, dateFrom, dateTo)
    const allRows = [...data.rows, data.summary]

    const headers: (keyof ReportRow)[] = [
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
    ]

    const headerLabels: Record<keyof ReportRow, string> = {
      nmId: 'Артикул ВБ', subjectName: 'Категория', vendorCode: 'Артикул', brandName: 'Бренд', photoUrl: '',
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
      ...allRows.map((row) => headers.map((h) => row[h])),
    ]

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64 = Buffer.from(buf).toString('base64')
    const filename = `report_${dateFrom}_${dateTo}.xlsx`

    return { success: true, data: { base64, filename } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка экспорта' }
  }
}
