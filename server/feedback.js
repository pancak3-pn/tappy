export function normalizeFeedback(body) {
  const rating = (value) => Number.isInteger(value) && value >= 1 && value <= 5 ? value : null
  const result = {
    rating:rating(body?.rating),
    productRating:rating(body?.productRating),
    serviceRating:rating(body?.serviceRating),
    displayName:typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 60) || 'Tappy customer' : 'Tappy customer',
    comment:typeof body?.comment === 'string' ? body.comment.trim().slice(0, 2000) : '',
  }
  if (!result.rating || !result.productRating || !result.serviceRating) throw new Error('Rate the product, the service, and your overall experience.')
  return result
}
