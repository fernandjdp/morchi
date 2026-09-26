'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/features/backoffice/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  price: z.coerce.number().positive().max(99999999),
  stock: z.coerce.number().int().min(0).max(100000),
  description: z.string().trim().max(2000).optional(),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
})

export async function createProduct(formData: FormData) {
  const admin = await requireAdmin()
  const parsed = productSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) redirect('/admin/productos/nuevo?error=validation')
  const values = parsed.data
  const supabase = createAdminClient()
  const slug = `${values.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 6)}`
  const { data: product, error } = await supabase.from('products').insert({
    name: values.name, slug, description: values.description || null, status: 'draft',
  }).select('id').single()
  if (error || !product) redirect('/admin/productos/nuevo?error=save')
  const sizeId = values.size ? await getAttributeId(supabase, 'sizes', values.size) : null
  const colorId = values.color ? await getAttributeId(supabase, 'colors', values.color) : null
  const { data: variant, error: variantError } = await supabase.from('product_variants').insert({
    product_id: product.id, sku: values.sku, price: values.price, is_active: true, size_id: sizeId, color_id: colorId,
  }).select('id').single()
  if (variantError || !variant) {
    await supabase.from('products').delete().eq('id', product.id)
    redirect('/admin/productos/nuevo?error=sku')
  }
  const { error: stockError } = await supabase.from('inventory_levels').insert({ variant_id: variant.id, quantity: values.stock, reserved_quantity: 0 })
  if (stockError) {
    await supabase.from('products').delete().eq('id', product.id)
    redirect('/admin/productos/nuevo?error=save')
  }
  if (values.category) {
    const categoryId = await getCategoryId(supabase, values.category)
    await supabase.from('product_categories').insert({product_id:product.id,category_id:categoryId})
  }
  revalidatePath('/admin')
  revalidatePath('/admin/productos')
  redirect('/admin/productos?created=1')
}

async function getAttributeId(supabase: ReturnType<typeof createAdminClient>, table: 'sizes'|'colors', name: string) {
  const { data, error } = await supabase.from(table).upsert({ name }, { onConflict: 'name' }).select('id').single()
  if (error || !data) throw new Error('No se pudo guardar el atributo de variante')
  return data.id
}

async function getCategoryId(supabase: ReturnType<typeof createAdminClient>, name: string) {
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const {data,error}=await supabase.from('categories').upsert({name,slug},{onConflict:'slug'}).select('id').single()
  if(error||!data) throw new Error('No se pudo guardar la categoría')
  return data.id
}

export async function addProductVariant(formData: FormData) {
  await requireAdmin()
  const input = z.object({ product_id: z.string().uuid(), sku: z.string().trim().min(2).max(64).regex(/^[\w-]+$/), price: z.coerce.number().positive(), stock: z.coerce.number().int().min(0), size: z.string().trim().max(40).optional(), color: z.string().trim().max(40).optional() }).safeParse(Object.fromEntries(formData))
  if (!input.success) redirect('/admin/productos')
  const supabase = createAdminClient()
  const sizeId = input.data.size ? await getAttributeId(supabase,'sizes',input.data.size) : null
  const colorId = input.data.color ? await getAttributeId(supabase,'colors',input.data.color) : null
  const {data:variant,error} = await supabase.from('product_variants').insert({product_id:input.data.product_id,sku:input.data.sku,price:input.data.price,is_active:true,size_id:sizeId,color_id:colorId}).select('id').single()
  if(error||!variant) redirect(`/admin/productos/${input.data.product_id}?error=sku`)
  const {error:stockError}=await supabase.from('inventory_levels').insert({variant_id:variant.id,quantity:input.data.stock,reserved_quantity:0})
  if(stockError){await supabase.from('product_variants').delete().eq('id',variant.id);redirect(`/admin/productos/${input.data.product_id}?error=save`)}
  revalidatePath(`/admin/productos/${input.data.product_id}`)
  revalidatePath('/admin/inventario')
  redirect(`/admin/productos/${input.data.product_id}?saved=1`)
}

export async function uploadProductImage(formData: FormData) {
  await requireAdmin()
  const productId = String(formData.get('product_id') ?? '')
  const altText = String(formData.get('alt_text') ?? '').trim().slice(0, 160)
  const file = formData.get('image')
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) redirect(`/admin/productos/${productId}?error=image`)
  const extByType: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
  const ext = extByType[file.type]
  if (!ext) redirect(`/admin/productos/${productId}?error=image`)
  const supabase = createAdminClient()
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    })
  if(uploadError) redirect(`/admin/productos/${productId}?error=image`)
  const {error:rowError} = await supabase.from('product_images').insert({product_id:productId,storage_path:path,alt_text:altText||null})
  if(rowError){await supabase.storage.from('product-images').remove([path]);redirect(`/admin/productos/${productId}?error=image`)}
  revalidatePath(`/admin/productos/${productId}`)
  revalidatePath('/admin/productos')
  redirect(`/admin/productos/${productId}?saved=image`)
}

export async function updateProduct(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const parsed = productSchema.pick({ name: true, description: true, category:true }).safeParse(Object.fromEntries(formData))
  const status = z.enum(['draft', 'active', 'archived']).safeParse(String(formData.get('status') ?? 'draft'))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success || !status.success) redirect('/admin/productos')
  const supabase = createAdminClient()
  if (status.data === 'active') {
    const { count } = await supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('product_id', id).eq('is_active', true)
    if (!count) redirect(`/admin/productos/${id}?error=variant`)
  }
  const { category, ...productFields } = parsed.data
  const { error } = await supabase.from('products').update({ ...productFields, status: status.data }).eq('id', id)
  if (error) redirect(`/admin/productos/${id}?error=save`)
  await supabase.from('product_categories').delete().eq('product_id',id)
  if(category){const categoryId=await getCategoryId(supabase,category);await supabase.from('product_categories').insert({product_id:id,category_id:categoryId})}
  revalidatePath('/admin')
  revalidatePath('/admin/productos')
  redirect('/admin/productos')
}
