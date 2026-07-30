import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FBS_STATUS_ACTION_LABELS,
  getFbsSupplierStatusLabel,
  getFbsWbStatusLabel,
} from './status-labels'

test('translates all documented FBS seller statuses', () => {
  assert.equal(getFbsSupplierStatusLabel('new'), 'Новое задание')
  assert.equal(getFbsSupplierStatusLabel('confirm'), 'На сборке')
  assert.equal(getFbsSupplierStatusLabel('complete'), 'В доставке')
  assert.equal(getFbsSupplierStatusLabel('cancel'), 'Отменено продавцом')
})

test('translates documented WB statuses including cancellation and carrier states', () => {
  assert.equal(getFbsWbStatusLabel('waiting'), 'В работе')
  assert.equal(getFbsWbStatusLabel('sorted'), 'Отсортировано')
  assert.equal(getFbsWbStatusLabel('canceled_by_client'), 'Отменено покупателем при получении')
  assert.equal(getFbsWbStatusLabel('declined_by_client'), 'Отменено покупателем в первый час')
  assert.equal(getFbsWbStatusLabel('accepted_by_carrier'), 'Передано перевозчику')
  assert.equal(getFbsWbStatusLabel('sent_to_carrier'), 'Отправлено на склад перевозчика')
})

test('keeps order actions in Russian and uses safe fallbacks for API drift', () => {
  assert.deepEqual(FBS_STATUS_ACTION_LABELS, {
    confirm: 'На сборку',
    complete: 'В доставку',
    cancel: 'Отменить',
  })
  assert.equal(getFbsSupplierStatusLabel('future_status'), 'Неизвестный статус продавца')
  assert.equal(getFbsWbStatusLabel('future_status'), 'Неизвестный статус WB')
})
