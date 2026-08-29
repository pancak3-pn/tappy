export const ORDER_STATUSES = Object.freeze([
  'pending_payment_verification',
  'pending_fulfillment',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
])

export const PAYMENT_STATUSES = Object.freeze([
  'awaiting_payment',
  'proof_submitted',
  'paid',
  'rejected',
])

const ORDER_TRANSITIONS = Object.freeze({
  pending_payment_verification:['pending_fulfillment', 'cancelled'],
  pending_fulfillment:['processing', 'cancelled'],
  processing:['shipped', 'cancelled'],
  shipped:['delivered'],
  delivered:[],
  cancelled:[],
})

const PAYMENT_TRANSITIONS = Object.freeze({
  awaiting_payment:['proof_submitted'],
  proof_submitted:['paid', 'rejected'],
  rejected:['proof_submitted'],
  paid:[],
})

export function allowedOrderTransitions(status) {
  return ORDER_TRANSITIONS[status] || []
}

export function canTransitionOrder(from, to, paymentStatus) {
  if (from === to) return true
  if (!allowedOrderTransitions(from).includes(to)) return false
  if (to === 'pending_fulfillment' && paymentStatus !== 'paid') return false
  return true
}

export function canTransitionPayment(from, to) {
  return from === to || (PAYMENT_TRANSITIONS[from] || []).includes(to)
}

export function lifecycleTimestamps(from, to, timestamp = new Date().toISOString()) {
  if (from === to) return {}
  if (to === 'pending_fulfillment') return { payment_approved_at:timestamp }
  if (to === 'processing') return { processing_started_at:timestamp }
  if (to === 'shipped') return { shipped_at:timestamp }
  if (to === 'delivered') return { delivered_at:timestamp }
  if (to === 'cancelled') return { cancelled_at:timestamp }
  return {}
}
