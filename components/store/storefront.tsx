'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ChevronRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'

import { CartDrawer } from '@/components/store/cart-drawer'
import { addToCartAction } from '@/features/cart/actions/cart-actions'
import type { Cart } from '@/features/cart/types'
import type { CatalogProduct } from '@/features/catalog/types'

const logoImage = '/morchi-logo.png'

const images = {
  hero: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/efren-barahona-LwKymbVpq0I-unsplash-U2Qx4ZYjuu5C44spCJSh1NutBHInn6.jpg',
  blackTee: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/engin-akyurt-sKGxVtKAGx0-unsplash-Z5YLcL9SI0CqvX8Vq5mA23E1CyQdhm.jpg',
  campaign: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/791889069_18091651292278334_6567695875891853846_n-E0JdKSfvoNjedSEOj7RdTuzyicDDW3.jpg',
}

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`

function productSizes(product: CatalogProduct): string[] {
  const sizes = product.variants
    .map((variant) => variant.size)
    .filter((size): size is string => Boolean(size))
  return sizes.length > 0 ? Array.from(new Set(sizes)) : ['Único']
}

function pickVariant(product: CatalogProduct, size: string | null) {
  const normalized = size ?? 'Único'
  const candidates = product.variants.filter(
    (variant) => (variant.size ?? 'Único') === normalized,
  )
  return candidates.find((variant) => variant.available > 0) ?? candidates[0] ?? null
}

const addErrorMessages: Record<string, string> = {
  insufficient_stock: 'No hay stock suficiente.',
  variant_not_buyable: 'Ese producto ya no está disponible.',
  invalid_quantity: 'La cantidad mínima es 1.',
  cart_unavailable: 'No pudimos actualizar el carrito.',
}

export function Storefront({
  products,
  initialCart,
}: {
  products: CatalogProduct[]
  initialCart: Cart | null
}) {
  const [category, setCategory] = useState('Todo')
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [cart, setCart] = useState<Cart | null>(initialCart)
  const [cartError, setCartError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sizeDrawerProduct, setSizeDrawerProduct] = useState<CatalogProduct | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const categories = useMemo(() => {
    const unique = new Set<string>()
    products.forEach((product) => {
      if (product.category) unique.add(product.category)
    })
    return ['Todo', ...Array.from(unique)]
  }, [products])

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = category === 'Todo' || product.category === category
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
        return matchesCategory && matchesSearch
      }),
    [products, category, search],
  )

  const addToCart = (variantId: string, quantity: number) => {
    setCartError(null)
    startTransition(async () => {
      const result = await addToCartAction(variantId, quantity)
      if (result.ok) {
        setCart(result.cart)
        setCartOpen(true)
        return
      }
      setCartError(addErrorMessages[result.error] ?? 'No pudimos agregar el producto.')
    })
  }

  const openSizeDrawer = (product: CatalogProduct) => {
    setSizeDrawerProduct(product)
    const firstAvailable = product.variants.find((variant) => variant.available > 0)
    setSelectedSize(firstAvailable?.size ?? product.variants[0]?.size ?? 'Único')
  }

  return (
    <main className="min-h-screen bg-[#f9e6d7] text-[#24635b]">
      <div className="bg-[#24635b] px-4 py-2 text-center text-[10px] font-medium tracking-[0.18em] text-[#f9e6d7] sm:text-xs">
        ENVÍOS GRATIS A TODO EL PAÍS SUPERANDO $120.000
      </div>

      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f9e6d7]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 lg:px-10">
          <button aria-label="Abrir menú" className="lg:hidden" onClick={() => setMobileMenu(true)}><Menu className="size-5" /></button>
          <a href="#inicio" aria-label="Morchi, inicio" className="flex items-center"><img src={logoImage} alt="Morchi" className="size-11 rounded-full object-cover ring-2 ring-[#24635b]/15 lg:size-14" /></a>
          <nav className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.16em] lg:flex">
            {['Novedades', 'Remeras', 'Pantalones', 'Calzado', 'Sale'].map((item) => <button key={item} onClick={() => setCategory(item === 'Remeras' ? 'Remeras' : 'Todo')} className="transition-opacity hover:opacity-50">{item}</button>)}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 border-b border-black/40 pb-1 md:flex">
              <Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="w-24 bg-transparent text-xs outline-none placeholder:text-black/50" aria-label="Buscar productos" />
            </div>
            <button aria-label="Mi cuenta" className="hidden sm:block"><UserRound className="size-5" /></button>
            <button aria-label="Abrir carrito" className="relative" onClick={() => setCartOpen(true)}><ShoppingBag className="size-5" />{(cart?.itemCount ?? 0) > 0 && <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-[#24635b] text-[9px] text-white">{cart?.itemCount}</span>}</button>
          </div>
        </div>
      </header>

      {mobileMenu && <div className="fixed inset-0 z-50 bg-[#f9e6d7] p-6 lg:hidden"><div className="flex items-center justify-between"><span className="flex items-center"><img src={logoImage} alt="Morchi" className="size-14 rounded-full object-cover ring-2 ring-[#24635b]/15" /></span><button aria-label="Cerrar menú" onClick={() => setMobileMenu(false)}><X /></button></div><nav className="mt-20 flex flex-col gap-7 font-[family-name:var(--font-lato)] text-2xl font-medium">{['Novedades', 'Remeras', 'Diseñar'].map((item) => <button className="text-left" key={item} onClick={() => { setCategory(item === 'Remeras' ? 'Remeras' : 'Todo'); setMobileMenu(false) }}>{item}</button>)}</nav></div>}

      <section id="inicio" className="mx-auto grid max-w-[1400px] gap-5 px-5 pb-14 pt-5 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:pt-8">
        <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] bg-[#d7d2c8] lg:min-h-[650px]"><img src={images.hero} alt="Campaña Morchi con dos modelos" className="absolute inset-0 size-full object-cover object-center grayscale-[20%]" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5" /><div className="absolute bottom-8 left-7 text-white sm:bottom-12 sm:left-12"><h1 className="max-w-lg text-5xl font-medium leading-[0.92] tracking-[-0.06em] sm:text-7xl">Vestite de lo que sos.</h1><button onClick={() => document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' })} className="mt-7 rounded-full border border-white px-6 py-3 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-white hover:text-black">Ver colección</button></div></div>
        <div className="flex min-h-[420px] flex-col justify-between rounded-[2rem] bg-[#d9e0d8] p-7 lg:min-h-[650px] lg:p-10"><div><h2 className="mt-5 max-w-sm text-4xl font-medium leading-[0.95] tracking-[-0.05em] lg:text-6xl">Básicos, pero nunca básicos.</h2></div><div className="relative mt-10 flex flex-1 items-end justify-center overflow-hidden"><img src={images.blackTee} alt="Remera negra oversized Morchi" className="h-full max-h-[370px] w-full rounded-[1.5rem] object-cover object-top mix-blend-multiply" /><span className="absolute bottom-5 left-5 rounded-full bg-[#f9e6d7] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.1em]">Comprar esenciales</span></div></div>
      </section>

      <section id="productos" className="mx-auto max-w-[1400px] px-5 py-12 lg:px-10 lg:py-20"><div className="mb-8 flex flex-col justify-between gap-5 border-b border-black/15 pb-5 sm:flex-row sm:items-end"><div><h2 className="mt-2 text-4xl tracking-[-0.05em]">Lo nuevo</h2></div><div className="flex items-center gap-5"><div className="hidden items-center gap-4 text-xs sm:flex">{categories.slice(0, 4).map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? 'border-b border-black pb-1' : 'text-black/45'}>{item}</button>)}</div><button className="flex items-center gap-2 text-xs uppercase tracking-[0.12em]"><SlidersHorizontal className="size-4" /> Filtrar</button></div></div>{visibleProducts.length === 0 ? <p className="rounded-[1.5rem] border border-black/10 bg-white/40 p-10 text-center text-sm text-black/55">Todavía no hay productos publicados.</p> : <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">{visibleProducts.map((product) => <article key={product.id} className="group"><div className="relative aspect-[0.8] overflow-hidden rounded-[1.5rem] bg-[#e9e7e1]">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-105" /> : <div className="flex size-full items-center justify-center text-xs text-black/40">Sin imagen</div>}{product.compareAtPriceFrom && <span className="absolute left-3 top-3 bg-[#f9e6d7] px-2 py-1 text-[9px] uppercase tracking-[0.14em]">Oferta</span>}{!product.isAvailable && <span className="absolute left-3 top-3 bg-[#f9e6d7] px-2 py-1 text-[9px] uppercase tracking-[0.14em]">Sin stock</span>}<button aria-label={`Agregar ${product.name} a favoritos`} className="absolute right-3 top-3 rounded-full bg-[#f9e6d7]/85 p-2 opacity-0 transition-opacity group-hover:opacity-100"><Heart className="size-4" /></button><button onClick={() => openSizeDrawer(product)} disabled={!product.isAvailable} className="absolute bottom-3 left-3 right-3 rounded-full bg-[#f9e6d7] py-3 text-[11px] font-medium uppercase tracking-[0.08em] opacity-100 transition-opacity disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100">+ Agregar</button></div><div className="pt-3"><div className="flex justify-between gap-2 text-sm"><h3>{product.name}</h3><span>{formatPrice(product.priceFrom)}</span></div><p className="mt-1 text-xs text-black/50">{[product.category, product.variants[0]?.color].filter(Boolean).join(' · ') || (product.productType ?? 'Producto')}</p></div></article>)}</div>}</section>

      <section className="mx-5 mb-16 overflow-hidden rounded-[2rem] bg-[#24635b] text-[#f9e6d7] lg:mx-10"><div className="grid items-center lg:grid-cols-2"><div className="order-2 p-8 sm:p-14 lg:order-1"><h2 className="mt-5 max-w-lg text-4xl leading-[0.95] tracking-[-0.06em] sm:text-6xl">Hecho para moverte, hecho para durar.</h2><p className="mt-7 max-w-md text-sm leading-6 text-white/65">Diseñamos prendas que acompañan tu ritmo. Materiales nobles, calces cómodos y una estética que habla por vos.</p><button className="mt-9 flex items-center gap-3 border-b border-white pb-2 text-xs uppercase tracking-[0.16em]">Conocé Morchi <ChevronRight className="size-4" /></button></div><img src={images.campaign} alt="Detalle de la identidad visual de Morchi" className="order-1 h-[420px] w-full object-cover lg:order-2 lg:h-[520px]" /></div></section>

      {sizeDrawerProduct && <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSizeDrawerProduct(null)}><section role="dialog" aria-modal="true" aria-labelledby="size-drawer-title" className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] bg-[#f9e6d7] p-5 shadow-2xl sm:left-auto sm:max-w-md" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#24635b]/25" /><div className="flex items-start gap-4">{sizeDrawerProduct.imageUrl && <img src={sizeDrawerProduct.imageUrl} alt={sizeDrawerProduct.name} className="size-24 rounded-2xl object-cover" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 id="size-drawer-title" className="text-xl leading-none tracking-[-0.03em]">{sizeDrawerProduct.name}</h2><p className="mt-2 text-xs text-black/55">{[sizeDrawerProduct.category, sizeDrawerProduct.variants[0]?.color].filter(Boolean).join(' · ')}</p></div><button aria-label="Cerrar selector de talle" onClick={() => setSizeDrawerProduct(null)}><X className="size-5" /></button></div><p className="mt-3 text-lg">{formatPrice(sizeDrawerProduct.priceFrom)}</p></div></div><div className="mt-7"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-medium">Elegí tu talle</h3><button className="text-xs text-black/55 underline underline-offset-4">Guía de talles</button></div><div className="grid grid-cols-5 gap-2">{productSizes(sizeDrawerProduct).map((size) => <button key={size} aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`rounded-full py-3 text-xs transition-colors ${selectedSize === size ? 'bg-[#24635b] text-[#f9e6d7]' : 'bg-white/60 text-[#24635b] hover:bg-white'}`}>{size}</button>)}</div></div><button onClick={() => { const variant = pickVariant(sizeDrawerProduct, selectedSize); if (variant) addToCart(variant.id, 1); setSizeDrawerProduct(null) }} disabled={pending} className="mt-6 w-full rounded-full bg-[#24635b] py-4 text-xs font-medium uppercase tracking-[0.08em] text-[#f9e6d7] disabled:opacity-50">Agregar talle {selectedSize}</button></section></div>}

      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onCartChange={setCart} />}

      {cartError && <div role="alert" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-red-700 px-5 py-3 text-xs text-white shadow-lg"><span>{cartError}</span><button onClick={() => setCartError(null)} className="underline">Cerrar</button></div>}

      <footer className="border-t border-black/10 px-5 py-8 lg:px-10"><div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-5 text-xs text-black/55 sm:flex-row"><span className="flex items-center"><img src={logoImage} alt="Morchi" className="size-10 rounded-full object-cover ring-2 ring-[#24635b]/15" /></span><span>Buenos Aires, Argentina · © 2025 Morchi</span><div className="flex gap-5"><a href="#inicio">Instagram</a><a href="#inicio">Contacto</a></div></div></footer>
    </main>
  )
}
