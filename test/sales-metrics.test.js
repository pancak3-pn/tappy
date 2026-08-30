import test from 'node:test'
import assert from 'node:assert/strict'
import { paidSalesByRegion } from '../shared/sales-metrics.js'

test('paid sales are grouped by delivery region with revenue share', () => {
  const regions = paidSalesByRegion([
    { delivery_region:'Luzon', quantity:1, total:279 },
    { delivery_region:'Luzon', quantity:2, total:478 },
    { delivery_region:'Visayas', quantity:1, total:299 },
  ])
  assert.deepEqual(regions, [
    { region:'Luzon', orders:2, cards:3, revenue:757, revenueShare:71.7 },
    { region:'Visayas', orders:1, cards:1, revenue:299, revenueShare:28.3 },
    { region:'Mindanao', orders:0, cards:0, revenue:0, revenueShare:0 },
  ])
})

test('historical paid orders without a region remain visible', () => {
  const regions = paidSalesByRegion([{ delivery_region:null, quantity:1, total:199 }])
  assert.equal(regions.at(-1).region, 'Unknown')
  assert.equal(regions.at(-1).orders, 1)
})
