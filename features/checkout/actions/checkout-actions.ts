'use server'

import { CartError } from '@/features/cart/services/cart-error'
import { checkoutCart } from '@/features/checkout/services/checkout-cart'
import { CheckoutError } from '@/features/checkout/services/checkout-error'

export type CheckoutActionResult =
  | { ok: true; orderId: string; preferenceId: string; initPoint: string | null }
  | { ok: false; error: string }

export async function checkoutCartAction(
  email: string,
  idempotencyKey?: string,
): Promise<CheckoutActionResult> {
  try {
    const result = await checkoutCart(email, idempotencyKey)
    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, error: error.code }
    if (error instanceof CartError) return { ok: false, error: error.code }
    return { ok: false, error: 'checkout_failed' }
  }
}
