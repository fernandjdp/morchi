import { requireAdmin } from '@/features/backoffice/auth'
import { adjustInventory } from '@/features/backoffice/actions/inventory'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin()
  const query=await searchParams
  const supabase=createAdminClient()
  const [{data:levels,error},{data:variants}] = await Promise.all([
    supabase.from('inventory_levels').select('variant_id,quantity,reserved_quantity,updated_at').order('updated_at',{ascending:false}).limit(200),
    supabase.from('product_variants').select('id,product_id,sku,price,is_active'),
  ])
  const productIds=[...new Set((variants??[]).map(v=>v.product_id))]
  const {data:products}=productIds.length?await supabase.from('products').select('id,name').in('id',productIds):{data:[]}
  const variantMap=new Map((variants??[]).map(v=>[v.id,v]))
  const productMap=new Map((products??[]).map(p=>[p.id,p.name]))
  return <div className="admin-content"><div className="admin-page-head"><div><div className="admin-kicker">OPERACIÓN</div><h1 className="admin-heading">Inventario</h1><p className="admin-subtitle">Disponibilidad por variante y ajustes con historial.</p></div></div>
    {query.error&&<div className="admin-notice">{query.error==='stock'?'El ajuste dejaría stock negativo.':query.error==='validation'?'Revisá el motivo y la cantidad del ajuste.':'No se pudo registrar el movimiento.'}</div>}{query.saved&&<div className="admin-notice" style={{background:'#edf5ee',color:'#456d50'}}>Ajuste registrado en el historial.</div>}
    <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCTO / VARIANTE</th><th>SKU</th><th>EN MANO</th><th>RESERVADO</th><th>DISPONIBLE</th><th>AJUSTAR</th></tr></thead><tbody>{(levels??[]).map(level=>{const variant=variantMap.get(level.variant_id);const available=level.quantity-level.reserved_quantity;return <tr key={level.variant_id}><td>{variant?productMap.get(variant.product_id)??'Producto':'Variante archivada'}<div className="admin-panel-caption">{variant?.is_active?'Variante activa':'Inactiva'}</div></td><td>{variant?.sku??'—'}</td><td>{level.quantity}</td><td>{level.reserved_quantity}</td><td><span className={`admin-pill ${available<=3?'pending':''}`}>{available}</span></td><td><form action={adjustInventory} className="admin-stock-form"><input type="hidden" name="variant_id" value={level.variant_id}/><input className="admin-input admin-delta" name="delta" type="number" step="1" required aria-label="Cantidad a ajustar" placeholder="±"/><input className="admin-input admin-reason" name="note" required minLength={3} maxLength={300} placeholder="Motivo del ajuste" aria-label="Motivo del ajuste"/><button className="admin-button">Aplicar</button></form></td></tr>})}</tbody></table>{error&&<div className="admin-notice">No se pudo consultar el inventario. Verificá las migraciones.</div>}{!error&&!levels?.length&&<div className="admin-empty">No hay variantes con inventario cargado.</div>}</div></section>
  </div>
}
