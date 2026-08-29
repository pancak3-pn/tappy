import test from 'node:test'
import assert from 'node:assert/strict'
import { allowedOrderTransitions, canTransitionOrder, canTransitionPayment, lifecycleTimestamps } from '../shared/order-lifecycle.js'

test('unpaid orders cannot enter fulfillment', () => {
  assert.equal(canTransitionOrder('pending_payment_verification', 'pending_fulfillment', 'proof_submitted'), false)
  assert.equal(canTransitionOrder('pending_payment_verification', 'pending_fulfillment', 'paid'), true)
})

test('orders follow the fulfillment sequence and cannot move backwards', () => {
  assert.deepEqual(allowedOrderTransitions('pending_fulfillment'), ['processing', 'cancelled'])
  assert.equal(canTransitionOrder('pending_fulfillment', 'processing', 'paid'), true)
  assert.equal(canTransitionOrder('processing', 'pending_fulfillment', 'paid'), false)
  assert.equal(canTransitionOrder('shipped', 'delivered', 'paid'), true)
  assert.equal(canTransitionOrder('delivered', 'processing', 'paid'), false)
})

test('payment decisions require a submitted proof', () => {
  assert.equal(canTransitionPayment('awaiting_payment', 'paid'), false)
  assert.equal(canTransitionPayment('proof_submitted', 'paid'), true)
  assert.equal(canTransitionPayment('proof_submitted', 'rejected'), true)
  assert.equal(canTransitionPayment('rejected', 'proof_submitted'), true)
  assert.equal(canTransitionPayment('paid', 'rejected'), false)
})

test('lifecycle timestamps are attached only when entering a new stage', () => {
  const time = '2026-08-30T00:00:00.000Z'
  assert.deepEqual(lifecycleTimestamps('processing', 'shipped', time), { shipped_at:time })
  assert.deepEqual(lifecycleTimestamps('shipped', 'shipped', time), {})
})
