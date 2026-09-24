export type CartLine = {
  id: string
  variantId: string
  quantity: number
  sku: string
  productName: string
  variantDescription: string | null
  unitPrice: number
  lineTotal: number
  available: number
  isValid: boolean
  imageUrl: string | null
}

export type Cart = {
  id: string
  status: 'active' | 'converted' | 'abandoned'
  lines: CartLine[]
  itemCount: number
  subtotal: number
  hasIssues: boolean
}

export type CheckoutCartItem = {
  variant_id: string
  quantity: number
}
