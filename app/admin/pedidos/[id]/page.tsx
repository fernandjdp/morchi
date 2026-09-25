import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/features/backoffice/auth'
import { updateFulfillment } from '@/features/backoffice/actions/orders'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function OrderDetails({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin()
  const {id}=await params
  const query=await searchParams
  const supabase=createAdminClient()
  const [{data:order},{data:items},{data:addresses}] = await Promise.all([
    supabase.from('orders').select('id,order_number,email,status,payment_status,fulfillment_status,total,subtotal,discount_total,shipping_total,currency,created_at,customer_note').eq('id',id).maybeSingle(),
    supabase.from('order_items').select('id,product_name,variant_description,sku,unit_price,quantity,line_total').eq('order_id',id),
    supabase.from('order_addresses').select('recipient_name,address_line1,address_line2,city,state,postal_code,country,phone,address_type').eq('order_id',id),
  ])
  if(!order) notFound()
  const next:Record<string,string>={unfulfilled:'processing',processing:'packed',packed:'shipped',shipped:'delivered',delivered:'returned'}
  return <div className="admin-content"><div className="admin-page-head"><div><div className="admin-kicker">PEDIDOS / #{order.order_number}</div><h1 className="admin-heading">Detalle del pedido</h1><p className="admin-subtitle">{order.email} · {new Date(order.created_at).toLocaleString('es-AR')}</p></div><Link href="/admin/pedidos" className="admin-panel-caption">← Todos los pedidos</Link></div>
    {query.error && <div className="admin-notice">{query.error==='audit'?'No se pudo guardar el historial del cambio.':'El estado cambió o la transición ya no es válida. Actualizá la página.'}</div>}{query.saved&&<div className="admin-notice" style={{background:'#edf5ee',color:'#456d50'}}>Estado de preparación actualizado.</div>}
    <div className="admin-panels"><section className="admin-panel"><div className="admin-panel-head"><div><h2 className="admin-panel-title">Artículos</h2><div className="admin-panel-caption">Snapshot comercial del momento de compra</div></div><span className="admin-pill">Pago: {order.payment_status}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCTO</th><th>SKU</th><th>PRECIO</th><th>CANT.</th><th>TOTAL</th></tr></thead><tbody>{(items??[]).map(item=><tr key={item.id}><td>{item.product_name}<div className="admin-panel-caption">{item.variant_description}</div></td><td>{item.sku}</td><td>{item.unit_price}</td><td>{item.quantity}</td><td>{item.line_total}</td></tr>)}</tbody></table></div><div className="admin-order-totals"><p>Subtotal <b>{order.subtotal} {order.currency}</b></p><p>Descuento <b>−{order.discount_total} {order.currency}</b></p><p>Envío <b>{order.shipping_total} {order.currency}</b></p><p>Total <b>{order.total} {order.currency}</b></p></div></section>
    <aside className="admin-panel"><h2 className="admin-panel-title">Preparación y envío</h2><p className="admin-panel-caption">Estado actual: <span className="admin-pill">{order.fulfillment_status}</span></p>{next[order.fulfillment_status]&&<form action={updateFulfillment} className="admin-form" style={{marginTop:20}}><input type="hidden" name="id" value={order.id}/><input type="hidden" name="status" value={next[order.fulfillment_status]}/><label>Nota de actividad<input className="admin-input" name="note" placeholder="Ej. Paquete listo para despacho" maxLength={500}/></label><button className="admin-button">Marcar como {next[order.fulfillment_status]}</button></form>}<h3 className="admin-panel-title" style={{marginTop:28}}>Dirección</h3>{(addresses??[]).filter(a=>a.address_type==='shipping').map((a,i)=><p key={i} className="admin-panel-caption">{a.recipient_name}<br/>{a.address_line1} {a.address_line2}<br/>{a.city}, {a.state} {a.postal_code}<br/>{a.country} · {a.phone}</p>)}</aside></div>
  </div>
}
