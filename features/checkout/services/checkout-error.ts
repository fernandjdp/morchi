export type CheckoutErrorCode =
  | 'empty_cart'
  | 'email_required'
  | 'invalid_quantity'
  | 'variant_not_buyable'
  | 'insufficient_stock'
  | 'cart_not_active'
  | 'order_creation_failed'
  | 'order_items_unavailable'
  | 'payment_persist_failed'

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode

  constructor(code: CheckoutErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CheckoutError'
    this.code = code
  }
}

export function mapDatabaseError(message: string): CheckoutError {
  if (message.includes('insufficient_stock')) return new CheckoutError('insufficient_stock')
  if (message.includes('variant_not_buyable')) return new CheckoutError('variant_not_buyable')
  if (message.includes('cart_not_active')) return new CheckoutError('cart_not_active')
  if (message.includes('empty_cart')) return new CheckoutError('empty_cart')
  if (message.includes('email_required')) return new CheckoutError('email_required')
  if (message.includes('invalid_quantity')) return new CheckoutError('invalid_quantity')
  return new CheckoutError('order_creation_failed')
}
