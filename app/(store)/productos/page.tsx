import type { Metadata } from 'next'

import { ProductGrid } from '@/components/store/product-grid'
import { listProducts } from '@/features/catalog/queries/list-products'

// El catálogo se renderiza por request. El caching/ISR puede habilitarse cuando
// el entorno de Supabase esté configurado (ARCHITECTURE.md §13).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Productos — Morchi',
  description: 'Explorá las prendas publicadas de Morchi.',
}

export default async function ProductosPage() {
  const products = await listProducts()

  return (
    <main className="min-h-screen bg-[#f9e6d7] text-[#24635b]">
      <div className="mx-auto max-w-[1400px] px-5 py-14 lg:px-10">
        <header className="mb-8 border-b border-black/15 pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-black/50">Catálogo</p>
          <h1 className="mt-2 text-4xl tracking-[-0.05em]">Productos</h1>
        </header>
        <ProductGrid products={products} />
      </div>
    </main>
  )
}
