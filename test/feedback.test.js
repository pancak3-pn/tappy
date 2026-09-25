import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFeedback } from '../server/feedback.js'

test('feedback normalization applies safe defaults and limits', () => {
  const result = normalizeFeedback({ rating:5, productRating:4, serviceRating:5, displayName:'  Jane C.  ', comment:'  Great card.  ' })
  assert.deepEqual(result, { rating:5, productRating:4, serviceRating:5, displayName:'Jane C.', comment:'Great card.' })
})

test('feedback normalization rejects ratings outside the allowed range', () => {
  assert.throws(() => normalizeFeedback({ rating:6, productRating:4, serviceRating:5 }), /Rate the product/)
})
