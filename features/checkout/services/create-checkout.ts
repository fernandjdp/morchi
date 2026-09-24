import 'server-only'

import { getSiteUrl } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CheckoutError, mapDatabaseError } from '@/features/checkout/services/checkout-error'
import type { CheckoutRequest } from '@/features/checkout/schemas/checkout.schema'
import { mercadoPagoProvider } from '@/features/payments/mercadopago/client'
import type { Json } from '@/types/database.types'

export type CreateCheckoutResult = {
  orderId: string
  preferenceId: string
  initPoint: string | null
}

/**
 * Crea un pedido con precios y stock validados server-side y genera la
 * preferencia de pago.
 *
 * - El precio, la disponibilidad y el total los calcula la base de datos
 *   dentro de `create_checkout_order` (transacción atómica).
 * - La identidad se obtiene de la sesión, nunca del cuerpo de la request.
 * - Si falla la generación de la preferencia, se libera el stock reservado.
 */
export async function createCheckout(
  input: CheckoutRequest,
  options: { cartId?: string } = {},
): Promise<CreateCheckoutResult> {
  const admin = createAdminClient()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const items = input.items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }))

  const { data: orderData, error: orderError } = await admin.rpc('create_checkout_order', {
    p_user_id: user?.id ?? null,
    p_email: input.email,
    p_items: items as unknown as Json,
    p_idempotency_key: input.idempotency_key ?? null,
    p_cart_id: options.cartId ?? null,
  })

  if (orderError) {
    throw mapDatabaseError(orderError.message)
  }

  const order = Array.isArray(orderData) ? orderData[0] : orderData
  if (!order) {
    throw new CheckoutError('order_creation_failed')
  }

  // Reintento idempotente: si ya existe una preferencia para el pedido, se
  // reutiliza en lugar de generar una nueva.
  const { data: existingPayment } = await admin
    .from('payments')
    .select('provider_preference_id')
    .eq('order_id', order.id)
    .not('provider_preference_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPayment?.provider_preference_id) {
    return {
      orderId: order.id,
      preferenceId: existingPayment.provider_preference_id,
      initPoint: null,
    }
  }

  try {
    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('variant_id, product_name, variant_description, unit_price, quantity')
      .eq('order_id', order.id)

    if (itemsError || !orderItems || orderItems.length === 0) {
      throw new CheckoutError('order_items_unavailable')
    }

    const siteUrl = getSiteUrl().replace(/\/$/, '')
    const preference = await mercadoPagoProvider.createPreference({
      orderId: order.id,
      payerEmail: input.email,
      notificationUrl: `${siteUrl}/api/webhooks/mercadopago`,
      items: orderItems.map((item) => ({
        id: item.variant_id ?? order.id,
        title: [item.product_name, item.variant_description].filter(Boolean).join(' · '),
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        currencyId: order.currency,
      })),
    })

    const { error: paymentError } = await admin.from('payments').insert({
      order_id: order.id,
      provider: 'mercadopago',
      provider_preference_id: preference.preferenceId,
      status: 'pending',
      amount: Number(order.total),
      currency: order.currency,
    })

    if (paymentError) {
      throw new CheckoutError('payment_persist_failed')
    }

    return {
      orderId: order.id,
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
    }
  } catch (error) {
    // Rollback lógico: libera la reserva y cancela el pedido pendiente.
    await admin.rpc('release_order_inventory', { p_order_id: order.id })
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    throw error
  }
}
