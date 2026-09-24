import type { CatalogProduct } from '@/features/catalog/types'

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-black/10 bg-white/40 p-10 text-center text-sm text-black/55">
        Todavía no hay productos publicados.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">
      {products.map((product) => (
        <li key={product.id} className="group">
          <div className="relative aspect-[0.8] overflow-hidden rounded-[1.5rem] bg-[#e9e7e1]">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-black/40">
                Sin imagen
              </div>
            )}
            {!product.isAvailable && (
              <span className="absolute left-3 top-3 bg-[#f9e6d7] px-2 py-1 text-[9px] uppercase tracking-[0.14em]">
                Sin stock
              </span>
            )}
          </div>
          <div className="pt-3">
            <div className="flex justify-between gap-2 text-sm">
              <h3>{product.name}</h3>
              <span>{formatPrice(product.priceFrom)}</span>
            </div>
            <p className="mt-1 text-xs text-black/50">
              {[product.category, product.variants[0]?.color]
                .filter(Boolean)
                .join(' · ') || (product.productType ?? 'Producto')}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
