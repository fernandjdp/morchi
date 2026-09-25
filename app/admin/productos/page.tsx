import Link from 'next/link'
import { requireAdmin } from '@/features/backoffice/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function ProductsPage() {
  await requireAdmin()
  const supabase = createAdminClient()
  const { data: products, error } = await supabase.from('products').select('id,name,slug,status,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(100)
  return <div className="admin-content">
    <div className="admin-page-head"><div><div className="admin-kicker">CATÁLOGO</div><h1 className="admin-heading">Productos</h1><p className="admin-subtitle">Administrá lo que está disponible en tu tienda.</p></div><Link href="/admin/productos/nuevo" className="admin-button">＋ Cargar producto</Link></div>
    {error && <div className="admin-notice">No se pudo consultar el catálogo. Verificá las migraciones de Supabase.</div>}
    <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCTO</th><th>ESTADO</th><th>CREADO</th><th>GESTIÓN</th></tr></thead><tbody>
      {(products ?? []).map((product) => <tr key={product.id}><td><strong>{product.name}</strong><div className="admin-panel-caption">{product.slug}</div></td><td><span className={`admin-pill ${product.status === 'draft' ? 'pending' : ''}`}>{product.status === 'active' ? 'Publicado' : product.status === 'draft' ? 'Borrador' : 'Archivado'}</span></td><td>{new Date(product.created_at).toLocaleDateString('es-AR')}</td><td><Link href={`/admin/productos/${product.id}`} className="admin-panel-caption">Editar →</Link></td></tr>)}
    </tbody></table>{!error && !products?.length && <div className="admin-empty">Todavía no hay productos. Cargá el primero para empezar.</div>}</div></section>
  </div>
}
