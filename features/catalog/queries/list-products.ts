import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'
import type { CatalogProduct, CatalogVariant } from '@/features/catalog/types'

export const PRODUCT_IMAGES_BUCKET = 'product-images'

type RawVariant = {
  id: string
  sku: string
  price: number
  compare_at_price: number | null
  is_active: boolean
  sizes: { name: string } | null
  colors: { name: string; hex_code: string | null } | null
}

type RawImage = {
  storage_path: string
  alt_text: string | null
  sort_order: number
}

type RawProductCategory = {
  categories: { id: string; name: string; slug: string } | null
}

type RawProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  product_type: string | null
  product_variants: RawVariant[] | null
  product_images: RawImage[] | null
  product_categories: RawProductCategory[] | null
}

/**
 * Lista los productos publicados con sus variantes activas, imágenes y
 * categorías. Lectura pública limitada por RLS (solo `status = 'active'`).
 */
export async function listProducts(): Promise<CatalogProduct[]> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('products')
    .select(
      `
        id,
        name,
        slug,
        description,
        product_type,
        product_variants ( id, sku, price, compare_at_price, is_active, sizes ( name ), colors ( name, hex_code ) ),
        product_images ( storage_path, alt_text, sort_order ),
        product_categories ( categories ( id, name, slug ) )
      `,
    )
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    // Allow the storefront shell to render while the connected database schema
    // is being provisioned or refreshed by Supabase.
    if (error.code === 'PGRST205') return []
    throw new Error(`No se pudo cargar el catálogo: ${error.message}`)
  }

  const products = (data ?? []) as unknown as RawProduct[]

  const variantIds = products.flatMap((product) =>
    (product.product_variants ?? []).filter((v) => v.is_active).map((v) => v.id),
  )

  const availability = await getAvailability(supabase, variantIds)

  return products.map((product) => mapProduct(supabase, product, availability))
}

async function getAvailability(
  supabase: ReturnType<typeof createPublicClient>,
  variantIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (variantIds.length === 0) return result

  const { data, error } = await supabase
    .from('product_variant_availability')
    .select('variant_id, available')
    .in('variant_id', variantIds)

  if (error) {
    // La disponibilidad no debe romper el catálogo: se degrada a 0.
    return result
  }

  for (const row of data ?? []) {
    if (row.variant_id) result.set(row.variant_id, row.available ?? 0)
  }
  return result
}

function mapProduct(
  supabase: ReturnType<typeof createPublicClient>,
  product: RawProduct,
  availability: Map<string, number>,
): CatalogProduct {
  const variants: CatalogVariant[] = (product.product_variants ?? [])
    .filter((variant) => variant.is_active)
    .map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: Number(variant.price),
      compareAtPrice:
        variant.compare_at_price === null ? null : Number(variant.compare_at_price),
      size: variant.sizes?.name ?? null,
      color: variant.colors?.name ?? null,
      colorHex: variant.colors?.hex_code ?? null,
      available: availability.get(variant.id) ?? 0,
    }))

  const prices = variants.map((variant) => variant.price)
  const comparePrices = variants
    .map((variant) => variant.compareAtPrice)
    .filter((price): price is number => price !== null)

  const images = [...(product.product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const imageUrls = images
    .map((image) => toPublicImageUrl(supabase, image.storage_path))
    .filter((url): url is string => url !== null)

  const categories = (product.product_categories ?? [])
    .map((relation) => relation.categories?.name)
    .filter((name): name is string => Boolean(name))

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    productType: product.product_type,
    category: categories[0] ?? null,
    categories,
    priceFrom: prices.length > 0 ? Math.min(...prices) : 0,
    compareAtPriceFrom: comparePrices.length > 0 ? Math.max(...comparePrices) : null,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    variants,
    isAvailable: variants.some((variant) => variant.available > 0),
  }
}

function toPublicImageUrl(
  supabase: ReturnType<typeof createPublicClient>,
  storagePath: string,
): string | null {
  if (!storagePath) return null
  if (storagePath.startsWith('http')) return storagePath

  const path = storagePath.replace(/^product-images\//, '')
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
