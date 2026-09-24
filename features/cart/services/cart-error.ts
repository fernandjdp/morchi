export type CartErrorCode =
  | 'empty_cart'
  | 'invalid_quantity'
  | 'variant_not_buyable'
  | 'insufficient_stock'
  | 'item_not_found'
  | 'cart_unavailable'

export class CartError extends Error {
  readonly code: CartErrorCode

  constructor(code: CartErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CartError'
    this.code = code
  }
}
