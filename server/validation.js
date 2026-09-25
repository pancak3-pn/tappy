export function normalizeOrder(body, { getDeliveryRegion, getDeliveryFee, unitPrice }) {
  const order = {
    name:typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '',
    email:typeof body?.email === 'string' ? body.email.trim().slice(0, 160).toLowerCase() : '',
    phone:typeof body?.phone === 'string' ? body.phone.trim().slice(0, 32) : '',
    address:typeof body?.address === 'string' ? body.address.trim().slice(0, 220) : '',
    city:typeof body?.city === 'string' ? body.city.trim().slice(0, 100) : '',
    province:typeof body?.province === 'string' ? body.province.trim().slice(0, 100) : '',
    postal:typeof body?.postal === 'string' ? body.postal.trim().slice(0, 16) : '',
    payment:typeof body?.payment === 'string' ? body.payment.trim().slice(0, 16) : '',
    quantity:Number(body?.quantity),
  }
  if (!order.name || !order.email.includes('@') || !order.phone || !order.address || !order.city || !order.province || !order.postal) throw new Error('Complete all customer and delivery fields.')
  if (!Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 10) throw new Error('Quantity must be between 1 and 10.')
  if (order.payment !== 'gcash') throw new Error('Choose a valid payment method.')
  const deliveryRegion = getDeliveryRegion(order.province)
  const shippingFee = getDeliveryFee(order.province)
  if (!deliveryRegion || shippingFee == null) throw new Error('Choose a supported Philippine province.')
  return { ...order, deliveryRegion, shippingFee, total:order.quantity * unitPrice + shippingFee }
}

export function parseReceiptData(value, maxBytes = 3_145_728) {
  const match = typeof value === 'string' && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error('Add the GCash reference, sender details, and a valid receipt image.')
  const receipt = Buffer.from(match[2], 'base64')
  if (!receipt.length || receipt.length > maxBytes) throw new Error('Receipt image must be smaller than 3 MB.')
  return { receipt, contentType:match[1], extension:match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1] }
}
