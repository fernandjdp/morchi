import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getDashboardData(days = 30) {
  const supabase = createAdminClient()
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)
  const priorSince = new Date(since)
  priorSince.setDate(priorSince.getDate() - days)
  const [{ data: orders, error: ordersError }, { data: stock, error: stockError }] = await Promise.all([
    supabase.from('orders').select('id, order_number, email, status, payment_status, fulfillment_status, total, discount_total, created_at').gte('created_at', priorSince.toISOString()).order('created_at', { ascending: false }).limit(5000),
    supabase.from('inventory_levels').select('variant_id, quantity, reserved_quantity').limit(5000),
  ])
  if (ordersError) throw new Error(`No se pudieron cargar los pedidos (${ordersError.code}).`)
  if (stockError) throw new Error(`No se pudo cargar el inventario (${stockError.code}).`)
  const allOrders = orders ?? []
  const validSale = (order: typeof allOrders[number]) => order.payment_status === 'approved' && !['cancelled', 'refunded'].includes(order.status)
  const periodOrders = allOrders.filter((o) => new Date(o.created_at) >= since)
  const previousOrders = allOrders.filter((o) => new Date(o.created_at) >= priorSince && new Date(o.created_at) < since)
  // orders.total ya es el importe final cobrado e incluye el descuento aplicado.
  const cents = (o: typeof allOrders[number]) => Math.round(Number(o.total) * 100)
  const currentSales = periodOrders.filter(validSale)
  const previousSales = previousOrders.filter(validSale)
  const revenueCents = currentSales.reduce((sum, o) => sum + cents(o), 0)
  const previousRevenueCents = previousSales.reduce((sum, o) => sum + cents(o), 0)
  const change = (a: number, b: number) => b === 0 ? null : Math.round(((a - b) / b) * 100)

  const orderIds = currentSales.map((o) => o.id)
  let items: Array<{ product_name: string; quantity: number; order_id: string }> = []
  if (orderIds.length) {
    const { data, error } = await supabase.from('order_items').select('product_name, quantity, order_id').in('order_id', orderIds)
    if (error) throw new Error(`No se pudieron cargar las líneas de pedido (${error.code}).`)
    items = data ?? []
  }
  const products = new Map<string, number>()
  for (const item of items) products.set(item.product_name, (products.get(item.product_name) ?? 0) + item.quantity)
  const trends = [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const chartSince = new Date()
  chartSince.setHours(0,0,0,0)
  chartSince.setDate(chartSince.getDate()-13)
  const daily = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(chartSince)
    date.setDate(date.getDate() + index)
    const key = date.toISOString().slice(0, 10)
    const amount = currentSales.filter((o) => o.created_at.slice(0, 10) === key).reduce((sum, o) => sum + cents(o), 0)
    return { date, amount }
  })
  const maxDaily = Math.max(...daily.map((point) => point.amount), 1)
  return {
    revenue: revenueCents,
    previousRevenue: previousRevenueCents,
    revenueChange: change(revenueCents, previousRevenueCents),
    sales: currentSales.length,
    salesChange: change(currentSales.length, previousSales.length),
    orders: periodOrders.length,
    pending: allOrders.filter((o) => o.payment_status === 'approved' && ['unfulfilled', 'processing', 'packed'].includes(o.fulfillment_status)).length,
    units: items.reduce((sum, item) => sum + item.quantity, 0),
    truncated: allOrders.length === 5000,
    trends,
    lowStock: (stock ?? []).filter((row) => row.quantity - row.reserved_quantity <= 3).length,
    chart: daily.map((point, index) => ({ ...point, x: 14 + index * 47, y: 154 - (point.amount / maxDaily) * 125 })),
  }
}
