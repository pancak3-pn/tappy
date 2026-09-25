import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOrder, parseReceiptData } from '../server/validation.js'

test('valid order normalization computes delivery and total', () => {
  const order = normalizeOrder({ name:'Jane Customer', email:'JANE@example.com', phone:'09123456789', address:'1 Test Street', city:'Quezon City', province:'Metro Manila', postal:'1100', payment:'gcash', quantity:2 }, { getDeliveryRegion:() => 'Metro Manila delivery', getDeliveryFee:() => 80, unitPrice:199 })
  assert.equal(order.email, 'jane@example.com')
  assert.equal(order.deliveryRegion, 'Metro Manila delivery')
  assert.equal(order.shippingFee, 80)
  assert.equal(order.total, 478)
})

test('receipt parsing rejects invalid data and accepts supported image types', () => {
  assert.throws(() => parseReceiptData('not-an-image'), /valid receipt image/)
  const parsed = parseReceiptData(`data:image/png;base64,${Buffer.from('receipt').toString('base64')}`)
  assert.equal(parsed.contentType, 'image/png')
  assert.equal(parsed.extension, 'png')
})
