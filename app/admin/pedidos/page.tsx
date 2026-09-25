import Link from 'next/link'
import { requireAdmin } from '@/features/backoffice/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin()
  const query = await searchParams
  const search = typeof query.q === 'string' ? query.q.trim() : ''
  const status = typeof query.status === 'string' ? query.status : ''
  const supabase = createAdminClient()
  let request = supabase.from('orders').select('id,order_number,email,status,payment_status,fulfillment_status,total,currency,created_at').order('created_at',{ascending:false}).limit(100)
  if (search) request = request.ilike('email', `%${search}%`)
  if (status && ['pending','confirmed','processing','shipped','completed','cancelled','refunded'].includes(status)) request = request.eq('status',status as never)
  const { data: orders, error } = await request
  return <div className="admin-content"><div className="admin-page-head"><div><div className="admin-kicker">OPERACIÓN</div><h1 className="admin-heading">Pedidos</h1><p className="admin-subtitle">Seguimiento de compras y preparación de envíos.</p></div></div>
    <section className="admin-panel"><form className="admin-toolbar" method="get"><input className="admin-input admin-search" name="q" defaultValue={search} placeholder="Buscar por correo del cliente"/><select className="admin-select" name="status" defaultValue={status}><option value="">Todos los estados</option>{['pending','confirmed','processing','shipped','completed','cancelled','refunded'].map(s=><option key={s} value={s}>{s}</option>)}</select><button className="admin-button">Filtrar</button></form>
      {error && <div className="admin-notice" style={{marginTop:16}}>No se pudieron cargar los pedidos. Verificá las migraciones de Supabase.</div>}
      <div className="admin-table-wrap" style={{marginTop:16}}><table className="admin-table"><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>PAGO</th><th>PREPARACIÓN</th><th></th></tr></thead><tbody>{(orders??[]).map(o=><tr key={o.id}><td className="admin-order-id">#{o.order_number}</td><td>{o.email}</td><td>{new Date(o.created_at).toLocaleDateString('es-AR')}</td><td>{new Intl.NumberFormat('es-AR',{style:'currency',currency:o.currency}).format(o.total)}</td><td><span className={`admin-pill ${o.payment_status==='pending'?'pending':''}`}>{o.payment_status}</span></td><td><span className="admin-pill">{o.fulfillment_status}</span></td><td><Link href={`/admin/pedidos/${o.id}`} className="admin-panel-caption">Abrir →</Link></td></tr>)}</tbody></table>{!error&&!orders?.length&&<div className="admin-empty">No encontramos pedidos para estos filtros.</div>}</div>
    </section></div>
}
