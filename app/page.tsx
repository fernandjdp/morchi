import { Storefront } from '@/components/store/storefront'
import { getCart } from '@/features/cart/services/cart-service'
import { listProducts } from '@/features/catalog/queries/list-products'

// El catálogo y el carrito se renderizan por request. El caching/ISR puede
// habilitarse cuando el entorno de Supabase esté configurado (ARCHITECTURE.md §13).
export const dynamic = 'force-dynamic'

export default async function Home() {
  const [products, cart] = await Promise.all([
    listProducts(),
    getCart().catch(() => null),
  ])
  return <Storefront products={products} initialCart={cart} />
}
