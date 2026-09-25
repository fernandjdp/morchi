import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/features/backoffice/auth'
import { addProductVariant, updateProduct, uploadProductImage } from '@/features/backoffice/actions/products'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const { id } = await params
  const query = await searchParams
  const supabase = createAdminClient()
  const [{ data: product }, { data: variants }, {data:sizes}, {data:colors}, {data:images}, {data:categoryLink}, {data:categories}] = await Promise.all([
    supabase.from('products').select('id,name,description,status').eq('id', id).maybeSingle(),
    supabase.from('product_variants').select('id,sku,price,is_active,size_id,color_id').eq('product_id', id),
    supabase.from('sizes').select('id,name'),
    supabase.from('colors').select('id,name'),
    supabase.from('product_images').select('id,storage_path,alt_text,sort_order').eq('product_id',id).order('sort_order'),
    supabase.from('product_categories').select('category_id').eq('product_id',id).limit(1).maybeSingle(),
    supabase.from('categories').select('id,name'),
  ])
  if (!product) notFound()
  return <div className="admin-content"><div className="admin-page-head"><div><div className="admin-kicker">CATÁLOGO / PRODUCTO</div><h1 className="admin-heading">Editar producto</h1><p className="admin-subtitle">Actualizá su información y estado de publicación.</p></div><Link href="/admin/productos" className="admin-panel-caption">← Volver</Link></div>
    {query.error && <div className="admin-notice">{query.error === 'variant' ? 'Agregá una variante activa antes de publicar.' : query.error==='sku'?'Ese SKU o combinación ya está en uso.':query.error==='image'?'La imagen debe ser JPG, PNG o WebP y pesar hasta 5 MB.':'No se pudieron guardar los cambios.'}</div>}
    <section className="admin-panel" style={{maxWidth:700}}><form action={updateProduct} className="admin-form"><input type="hidden" name="id" value={product.id}/>
      <label>Nombre<input className="admin-input" name="name" defaultValue={product.name} required/></label><label>Descripción<textarea className="admin-input" name="description" rows={4} defaultValue={product.description ?? ''}/></label><label>Categoría<input className="admin-input" name="category" defaultValue={categories?.find(c=>c.id===categoryLink?.category_id)?.name??''} maxLength={60}/></label>
      <label>Estado<select className="admin-select" name="status" defaultValue={product.status}><option value="draft">Borrador</option><option value="active">Publicado</option><option value="archived">Archivado</option></select></label>
      <button type="submit" className="admin-button">Guardar cambios</button>
    </form><h2 className="admin-panel-title" style={{marginTop:30}}>Variantes</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SKU</th><th>TALLE / COLOR</th><th>PRECIO</th><th>ESTADO</th></tr></thead><tbody>{(variants ?? []).map(v=><tr key={v.id}><td>{v.sku}</td><td>{sizes?.find(s=>s.id===v.size_id)?.name??'Único'} / {colors?.find(c=>c.id===v.color_id)?.name??'—'}</td><td>{new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(v.price)}</td><td>{v.is_active?'Activa':'Inactiva'}</td></tr>)}</tbody></table></div>
    <form id="add-variant" action={addProductVariant} className="admin-form" style={{marginTop:20}}><input type="hidden" name="product_id" value={product.id}/><div className="admin-form-grid"><label>Nuevo SKU<input className="admin-input" name="sku" required placeholder="REM-ESS-M-NG"/></label><label>Talle<input className="admin-input" name="size" placeholder="M"/></label><label>Color<input className="admin-input" name="color" placeholder="Negro"/></label><label>Precio<input className="admin-input" name="price" type="number" step="0.01" min="0.01" required/></label><label>Stock inicial<input className="admin-input" name="stock" type="number" min="0" required/></label></div><button className="admin-button">＋ Agregar variante</button></form>
    <h2 className="admin-panel-title" style={{marginTop:30}}>Imágenes</h2><div className="admin-image-list">{(images??[]).map(image=><div key={image.id}><img src={supabase.storage.from('product-images').getPublicUrl(image.storage_path).data.publicUrl} alt={image.alt_text??product.name}/><span>{image.alt_text??'Sin descripción'}</span></div>)}</div><form action={uploadProductImage} className="admin-form" style={{marginTop:16}}><input type="hidden" name="product_id" value={product.id}/><div className="admin-form-grid"><label>Archivo<input className="admin-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" required/></label><label>Texto alternativo<input className="admin-input" name="alt_text" maxLength={160} placeholder={product.name}/></label></div><button className="admin-button">Subir imagen</button></form></section></div>
}
