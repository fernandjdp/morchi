export type CatalogVariant = {
  id: string
  sku: string
  price: number
  compareAtPrice: number | null
  size: string | null
  color: string | null
  colorHex: string | null
  available: number
}

export type CatalogProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  productType: string | null
  category: string | null
  categories: string[]
  priceFrom: number
  compareAtPriceFrom: number | null
  imageUrl: string | null
  imageUrls: string[]
  variants: CatalogVariant[]
  isAvailable: boolean
}
