import 'server-only'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CartError } from '@/features/cart/services/cart-error'
import type { Cart, CartLine, CheckoutCartItem } from '@/features/cart/types'
import type { Database } from '@/types/database.types'

const CART_COOKIE = 'morchi_cart_token'
const PRODUCT_IMAGES_BUCKET = 'product-images'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

type AdminClient = ReturnType<typeof createAdminClient>
type CartRow = Database['public']['Tables']['carts']['Row']
type Owner = { userId: string | null; sessionToken: string | null }

type RawCartItem = {
  id: string
  quantity: number
  variant_id: string
  product_variants: {
    id: string
    sku: string
    price: number
    is_active: boolean
    sizes: { name: string } | null
    colors: { name: string } | null
    products: {
      name: string
      status: string
      deleted_at: string | null
      product_images: { storage_path: string; sort_order: number }[] | null
    } | null
  } | null
}

/**
 * Resuelve el dueño del carrito desde el servidor: sesión autenticada o cookie
 * anónima httpOnly. Nunca se confía en un identificador enviado por el cliente.
 */
async function resolveOwner(): Promise<Owner> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return { userId: user.id, sessionToken: null }
  }

  const cookieStore = await cookies()
  return { userId: null, sessionToken: cookieStore.get(CART_COOKIE)?.value ?? null }
}

async function findActiveCart(admin: AdminClient, owner: Owner): Promise<CartRow | null> {
  if (owner.userId) {
    const { data } = await admin
      .from('carts')
      .select('*')
      .eq('status', 'active')
      .eq('user_id', owner.userId)
      .maybeSingle()
    return data ?? null
  }

  if (owner.sessionToken) {
    const { data } = await admin
      .from('carts')
      .select('*')
      .eq('status', 'active')
      .eq('session_token', owner.sessionToken)
      .maybeSingle()
    return data ?? null
  }

  return null
}

async function createCart(admin: AdminClient, owner: Owner): Promise<CartRow> {
  let sessionToken = owner.sessionToken

  if (!owner.userId && !sessionToken) {
    sessionToken = randomUUID()
    const cookieStore = await cookies()
    cookieStore.set(CART_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
  }

  const { data, error } = await admin
    .from('carts')
    .insert({
      user_id: owner.userId,
      session_token: owner.userId ? null : sessionToken,
      status: 'active',
    })
    .select()
    .single()

  if (error || !data) {
    // Carrera entre dos altas concurrentes: reutiliza el carrito existente.
    const existing = await findActiveCart(admin, { ...owner, sessionToken })
    if (existing) return existing
    throw new CartError('cart_unavailable', error?.message)
  }

  return data
}

export async function getCart(): Promise<Cart | null> {
  const admin = createAdminClient()
  const owner = await resolveOwner()
  const cart = await findActiveCart(admin, owner)
  if (!cart) return null
  return buildCart(admin, cart)
}

export async function addCartItem(variantId: string, quantity: number): Promise<Cart> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('invalid_quantity')
  }

  const admin = createAdminClient()
  const owner = await resolveOwner()
  const cart = (await findActiveCart(admin, owner)) ?? (await createCart(admin, owner))

  const variant = await getBuyableVariant(admin, variantId)
  if (!variant) throw new CartError('variant_not_buyable')

  const { data: existing } = await admin
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('variant_id', variantId)
    .maybeSingle()

  const nextQuantity = (existing?.quantity ?? 0) + quantity
  if (variant.available < nextQuantity) throw new CartError('insufficient_stock')

  if (existing) {
    await admin.from('cart_items').update({ quantity: nextQuantity }).eq('id', existing.id)
  } else {
    const { error } = await admin
      .from('cart_items')
      .insert({ cart_id: cart.id, variant_id: variantId, quantity })
    if (error) throw new CartError('cart_unavailable', error.message)
  }

  return buildCart(admin, cart)
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('invalid_quantity')
  }

  const admin = createAdminClient()
  const owner = await resolveOwner()
  const cart = await findActiveCart(admin, owner)
  if (!cart) throw new CartError('item_not_found')

  const { data: item } = await admin
    .from('cart_items')
    .select('id, variant_id')
    .eq('id', itemId)
    .eq('cart_id', cart.id)
    .maybeSingle()
  if (!item) throw new CartError('item_not_found')

  const availability = await getAvailability(admin, [item.variant_id])
  if ((availability.get(item.variant_id) ?? 0) < quantity) {
    throw new CartError('insufficient_stock')
  }

  await admin.from('cart_items').update({ quantity }).eq('id', item.id)
  return buildCart(admin, cart)
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const admin = createAdminClient()
  const owner = await resolveOwner()
  const cart = await findActiveCart(admin, owner)
  if (!cart) throw new CartError('item_not_found')

  await admin.from('cart_items').delete().eq('id', itemId).eq('cart_id', cart.id)
  return buildCart(admin, cart)
}

/**
 * Devuelve las líneas del carrito activo para iniciar checkout (FR-007).
 * La validación final de disponibilidad la hace `create_checkout_order`.
 */
export async function getActiveCartItems(): Promise<{
  cartId: string
  items: CheckoutCartItem[]
}> {
  const admin = createAdminClient()
  const owner = await resolveOwner()
  const cart = await findActiveCart(admin, owner)
  if (!cart) throw new CartError('empty_cart')

  const { data } = await admin
    .from('cart_items')
    .select('variant_id, quantity')
    .eq('cart_id', cart.id)

  const items = (data ?? []).map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }))

  if (items.length === 0) throw new CartError('empty_cart')
  return { cartId: cart.id, items }
}

/** Reabre un carrito convertido si el checkout falló después de crear el pedido. */
export async function reopenCart(cartId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('carts')
    .update({ status: 'active' })
    .eq('id', cartId)
    .eq('status', 'converted')
}

async function getBuyableVariant(
  admin: AdminClient,
  variantId: string,
): Promise<{ id: string; available: number } | null> {
  const { data } = await admin
    .from('product_variants')
    .select('id, is_active, products ( status, deleted_at )')
    .eq('id', variantId)
    .maybeSingle()

  const row = data as unknown as
    | { id: string; is_active: boolean; products: { status: string; deleted_at: string | null } | null }
    | null

  if (!row || !row.is_active) return null
  if (!row.products || row.products.status !== 'active' || row.products.deleted_at) return null

  const availability = await getAvailability(admin, [variantId])
  return { id: variantId, available: availability.get(variantId) ?? 0 }
}

async function getAvailability(
  admin: AdminClient,
  variantIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (variantIds.length === 0) return result

  const { data } = await admin
    .from('product_variant_availability')
    .select('variant_id, available')
    .in('variant_id', variantIds)

  for (const row of data ?? []) {
    if (row.variant_id) result.set(row.variant_id, row.available ?? 0)
  }
  return result
}

async function buildCart(admin: AdminClient, cart: CartRow): Promise<Cart> {
  const { data, error } = await admin
    .from('cart_items')
    .select(
      `
        id,
        quantity,
        variant_id,
        product_variants ( id, sku, price, is_active, sizes ( name ), colors ( name ), products ( name, status, deleted_at, product_images ( storage_path, sort_order ) ) )
      `,
    )
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true })

  if (error) throw new CartError('cart_unavailable', error.message)

  const rows = (data ?? []) as unknown as RawCartItem[]
  const availability = await getAvailability(
    admin,
    rows.map((row) => row.variant_id),
  )

  const lines: CartLine[] = rows.map((row) => {
    const variant = row.product_variants
    const product = variant?.products ?? null
    const available = availability.get(row.variant_id) ?? 0
    const isBuyable = Boolean(
      variant?.is_active && product && product.status === 'active' && !product.deleted_at,
    )
    const unitPrice = Number(variant?.price ?? 0)

    return {
      id: row.id,
      variantId: row.variant_id,
      quantity: row.quantity,
      sku: variant?.sku ?? '',
      productName: product?.name ?? 'Producto',
      variantDescription:
        [variant?.sizes?.name, variant?.colors?.name].filter(Boolean).join(' / ') || null,
      unitPrice,
      lineTotal: unitPrice * row.quantity,
      available,
      isValid: isBuyable && available >= row.quantity,
      imageUrl: toImageUrl(admin, firstImagePath(product?.product_images)),
    }
  })

  return {
    id: cart.id,
    status: cart.status,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    hasIssues: lines.some((line) => !line.isValid),
  }
}

function firstImagePath(
  images: { storage_path: string; sort_order: number }[] | null | undefined,
): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
  return sorted[0]?.storage_path ?? null
}

function toImageUrl(admin: AdminClient, storagePath: string | null): string | null {
  if (!storagePath) return null
  if (storagePath.startsWith('http')) return storagePath
  const path = storagePath.replace(/^product-images\//, '')
  return admin.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}
