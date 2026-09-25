import Link from 'next/link'
import { requireAdmin } from '@/features/backoffice/auth'
import { createProduct } from '@/features/backoffice/actions/products'

export default async function NewProductPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const query = await searchParams
  return <div className="admin-content"><div className="admin-page-head"><div><div className="admin-kicker">CATÁLOGO / NUEVO</div><h1 className="admin-heading">Cargar producto</h1><p className="admin-subtitle">Creá un borrador con su primera variante e inventario inicial.</p></div><Link href="/admin/productos" className="admin-panel-caption">← Volver</Link></div>
    {query.error && <div className="admin-notice">{query.error === 'sku' ? 'Ese SKU ya existe. Probá con uno único.' : 'Revisá los campos e intentá nuevamente.'}</div>}
    <section className="admin-panel" style={{maxWidth:700}}><form action={createProduct} className="admin-form">
      <label>Nombre del producto<input className="admin-input" name="name" required minLength={2} maxLength={120} placeholder="Remera Essential"/></label>
      <label>Descripción<textarea className="admin-input" name="description" rows={4} maxLength={2000} placeholder="Contá de qué está hecha y cómo calza."/></label>
      <label>Categoría<input className="admin-input" name="category" maxLength={60} placeholder="Básicos"/></label>
      <div className="admin-form-grid"><label>SKU inicial<input className="admin-input" name="sku" required placeholder="REM-ESS-01"/></label><label>Precio (ARS)<input className="admin-input" name="price" type="number" min="0.01" step="0.01" required placeholder="25000"/></label><label>Stock inicial<input className="admin-input" name="stock" type="number" min="0" step="1" required placeholder="12"/></label></div>
      <div className="admin-form-grid"><label>Talle<input className="admin-input" name="size" placeholder="M"/></label><label>Color<input className="admin-input" name="color" placeholder="Negro"/></label></div>
      <div className="admin-notice">El producto se guardará como borrador. Podrás publicarlo al completar el resto de sus variantes e imágenes.</div><button className="admin-button" type="submit">Guardar borrador</button>
    </form></section></div>
}
