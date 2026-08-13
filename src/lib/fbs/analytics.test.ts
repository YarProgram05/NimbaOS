import assert from 'node:assert/strict'
import test from 'node:test'
import { isFbsCanceledOrder, summarizeFbsAnalytics } from './analytics'

test('FBS finance follows orderId when WB leaves deliveryMethod empty on sale rows', () => {
  const result = summarizeFbsAnalytics({
    orders: [
      {
        externalOrderId: BigInt(101),
        nmId: 11,
        vendorCode: 'FBS-11',
        supplierStatus: 'complete',
        wbStatus: 'sold',
      },
      {
        externalOrderId: BigInt(102),
        nmId: 11,
        vendorCode: 'FBS-11',
        supplierStatus: 'complete',
        wbStatus: 'canceled_by_client',
      },
    ],
    knownFbsOrderIds: new Set(['101', '102']),
    financeRows: [
      {
        orderId: BigInt(101),
        deliveryMethod: '',
        nmId: 11,
        vendorCode: 'FBS-11',
        docTypeName: 'Продажа',
        quantity: 1,
        retailPriceWithDisc: '1000',
        ppvzSppPrc: '10',
        ppvzForPay: '700',
        deliveryRub: '100', storageFee: '0', acceptance: '0', additionalPayment: '0', penalty: '0', deduction: '0',
      },
      {
        orderId: BigInt(101),
        deliveryMethod: '',
        nmId: 11,
        vendorCode: 'FBS-11',
        docTypeName: 'Возврат',
        quantity: 1,
        retailPriceWithDisc: '1000',
        ppvzSppPrc: '10',
        ppvzForPay: '700',
        deliveryRub: '100', storageFee: '0', acceptance: '0', additionalPayment: '0', penalty: '0', deduction: '0',
      },
      {
        orderId: BigInt(999),
        deliveryMethod: 'FBW, (МГТ, короба)',
        nmId: 99,
        vendorCode: 'FBW-99',
        docTypeName: 'Продажа',
        quantity: 5,
        retailPriceWithDisc: '5000',
        ppvzSppPrc: '0',
        ppvzForPay: '4000',
        deliveryRub: '0', storageFee: '0', acceptance: '0', additionalPayment: '0', penalty: '0', deduction: '0',
      },
    ],
  })

  assert.equal(result.orders, 2)
  assert.equal(result.cancellations, 1)
  assert.equal(result.sales, 1)
  assert.equal(result.returns, 1)
  assert.equal(result.revenue, 0)
  assert.equal(result.toTransfer, 0)
  assert.equal(result.financeByArticle.length, 1)
  assert.equal(result.financeByArticle[0]?.orders, 2)
  assert.equal(result.financeByArticle[0]?.cancellations, 1)
})

test('a directly tagged FBS sale is counted without an operational order match', () => {
  const result = summarizeFbsAnalytics({
    orders: [],
    knownFbsOrderIds: new Set(),
    financeRows: [
      {
        orderId: null,
        deliveryMethod: 'FBS, (МГТ)',
        nmId: 21,
        vendorCode: 'FBS-21',
        docTypeName: 'Продажа',
        quantity: 2,
        retailPriceWithDisc: '1500',
        ppvzSppPrc: '20',
        ppvzForPay: '900',
        deliveryRub: '100', storageFee: '20', acceptance: '0', additionalPayment: '0', penalty: '0', deduction: '0',
      },
    ],
  })

  assert.equal(result.sales, 2)
  assert.equal(result.revenue, 1200)
  assert.equal(result.toTransfer, 900)
  assert.equal(result.financeByArticle[0]?.operatingProfit, 780)
  assert.equal(result.financeByArticle[0]?.marginality, 65)
  assert.equal(result.financeByArticle[0]?.profitability, 185.71428571428572)
  assert.equal(result.financeByArticle[0]?.buyoutPercent, 100)
  assert.equal(result.operatingProfit, 780)
  assert.equal(result.marginality, 65)
  assert.equal(result.profitability, 185.71428571428572)
  assert.equal(result.buyoutPercent, 100)
})

test('FBS cancellation classification counts each terminal order once', () => {
  assert.equal(isFbsCanceledOrder({ supplierStatus: 'cancel', wbStatus: 'canceled' }), true)
  assert.equal(
    isFbsCanceledOrder({ supplierStatus: 'complete', wbStatus: 'declined_by_client' }),
    true,
  )
  assert.equal(isFbsCanceledOrder({ supplierStatus: 'complete', wbStatus: 'sold' }), false)
})
