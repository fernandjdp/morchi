'use server'

import { CartError } from '@/features/cart/services/cart-error'
import {
  addCartItem,
  removeCartItem,
  updateCartItem,
} from '@/features/cart/services/cart-service'
import type { Cart } from '@/features/cart/types'

export type CartActionResult = { ok: true; cart: Cart } | { ok: false; error: string }

function toErrorCode(error: unknown): string {
  if (error instanceof CartError) return error.code
  return 'cart_unavailable'
}

export async function addToCartAction(
  variantId: string,
  quantity: number,
): Promise<CartActionResult> {
  try {
    return { ok: true, cart: await addCartItem(variantId, quantity) }
  } catch (error) {
    return { ok: false, error: toErrorCode(error) }
  }
}

export async function updateCartItemAction(
  itemId: string,
  quantity: number,
): Promise<CartActionResult> {
  try {
    return { ok: true, cart: await updateCartItem(itemId, quantity) }
  } catch (error) {
    return { ok: false, error: toErrorCode(error) }
  }
}

export async function removeCartItemAction(itemId: string): Promise<CartActionResult> {
  try {
    return { ok: true, cart: await removeCartItem(itemId) }
  } catch (error) {
    return { ok: false, error: toErrorCode(error) }
  }
}
