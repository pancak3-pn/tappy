const DELIVERY_REGION_ORDER = ['Luzon', 'Visayas', 'Mindanao', 'Unknown']

export function paidSalesByRegion(orders) {
  const totals = new Map(DELIVERY_REGION_ORDER.map((region) => [region, { region, orders:0, cards:0, revenue:0, revenueShare:0 }]))
  for (const order of orders || []) {
    const region = DELIVERY_REGION_ORDER.includes(order.delivery_region) ? order.delivery_region : 'Unknown'
    const entry = totals.get(region)
    entry.orders += 1
    entry.cards += Number(order.quantity || 0)
    entry.revenue += Number(order.total || 0)
  }
  const revenue = [...totals.values()].reduce((sum, entry) => sum + entry.revenue, 0)
  return [...totals.values()]
    .filter((entry) => entry.region !== 'Unknown' || entry.orders > 0)
    .map((entry) => ({ ...entry, revenueShare:revenue ? Math.round((entry.revenue / revenue) * 1000) / 10 : 0 }))
}
