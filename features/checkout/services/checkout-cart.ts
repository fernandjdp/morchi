import 'server-only'

import { getActiveCartItems, reopenCart } from '@/features/cart/services/cart-service'
import { CheckoutError } from '@/features/checkout/services/checkout-error'
import { createCheckout } from '@/features/checkout/services/create-checkout'

export type CheckoutCartResult = {
  orderId: string
  preferenceId: string
  initPoint: string | null
}

/**
 * Convierte el carrito activo en un pedido y genera la preferencia de pago.
 *
 * La disponibilidad y la conversión del carrito se resuelven dentro de la
 * transacción `create_checkout_order` (FR-009, SC-003). Si el pedido se crea
 * pero falla la preferencia, se reabre el carrito para permitir reintentar.
 */
export async function checkoutCart(
  email: string,
  idempotencyKey?: string,
): Promise<CheckoutCartResult> {
  const { cartId, items } = await getActiveCartItems()

  try {
    return await createCheckout(
      { items, email, idempotency_key: idempotencyKey },
      { cartId },
    )
  } catch (error) {
    // Otro checkout se quedó con el carrito: no reabrir.
    if (!(error instanceof CheckoutError && error.code === 'cart_not_active')) {
      await reopenCart(cartId)
    }
    throw error
  }
}
