import { test, expect } from '@playwright/test'

test('homepage and order navigation are available', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Tappy/i)
  const orderLink = page.getByRole('link', { name:/order tappy/i }).first()
  await expect(orderLink).toBeVisible()
  await orderLink.click()
  await expect(page).toHaveURL(/\/order$/)
})

test('feedback page is reachable and protects the request form', async ({ page }) => {
  const response = await page.goto('/feedback')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name:/tappy feedback/i })).toBeVisible()
  await expect(page.getByLabel(/order email/i)).toHaveAttribute('type', 'email')
})

test('unknown NFC links return a controlled not-found response', async ({ page }) => {
  const response = await page.goto('/t/does-not-exist')
  expect(response?.status()).toBe(404)
})

test('admin orders endpoint rejects unauthenticated requests', async ({ request }) => {
  const response = await request.get('/api/admin/orders')
  expect(response.status()).toBe(401)
})
