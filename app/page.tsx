'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'

const images = {
  hero: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/efren-barahona-LwKymbVpq0I-unsplash-U2Qx4ZYjuu5C44spCJSh1NutBHInn6.jpg',
  blackTee: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/engin-akyurt-sKGxVtKAGx0-unsplash-Z5YLcL9SI0CqvX8Vq5mA23E1CyQdhm.jpg',
  campaign: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/791889069_18091651292278334_6567695875891853846_n-E0JdKSfvoNjedSEOj7RdTuzyicDDW3.jpg',
}

const products = [
  { name: 'Remera Essential', category: 'Remeras', price: 28900, tag: 'Nuevo', image: images.blackTee, color: 'Negro' },
  { name: 'Remera Logo Morchi', category: 'Remeras', price: 32900, tag: 'Más vendido', image: images.hero, color: 'Crudo' },
  { name: 'Hoodie Studio', category: 'Abrigos', price: 64900, tag: 'Nuevo', image: images.campaign, color: 'Verde' },
  { name: 'Pantalón Wide Leg', category: 'Pantalones', price: 58900, tag: '', image: images.hero, color: 'Negro' },
]

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`

export default function Home() {
  const [category, setCategory] = useState('Todo')
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [search, setSearch] = useState('')

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'Todo' || product.category === category
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  }), [category, search])

  const addToCart = () => {
    setCartCount((count) => count + 1)
    setCartOpen(true)
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3] text-[#1e201f]">
      <div className="bg-[#1e201f] px-4 py-2 text-center text-[10px] font-medium tracking-[0.18em] text-[#f7f6f3] sm:text-xs">
        ENVÍOS GRATIS A TODO EL PAÍS SUPERANDO $120.000
      </div>

      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f6f3]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 lg:px-10">
          <button aria-label="Abrir menú" className="lg:hidden" onClick={() => setMobileMenu(true)}><Menu className="size-5" /></button>
          <a href="#inicio" className="font-serif text-4xl italic tracking-[-0.08em] lg:text-5xl">Morchi</a>
          <nav className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.16em] lg:flex">
            {['Novedades', 'Remeras', 'Pantalones', 'Calzado', 'Sale'].map((item) => <button key={item} onClick={() => setCategory(item === 'Remeras' ? 'Remeras' : 'Todo')} className="transition-opacity hover:opacity-50">{item}</button>)}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 border-b border-black/40 pb-1 md:flex">
              <Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="w-24 bg-transparent text-xs outline-none placeholder:text-black/50" aria-label="Buscar productos" />
            </div>
            <button aria-label="Mi cuenta" className="hidden sm:block"><UserRound className="size-5" /></button>
            <button aria-label="Abrir carrito" className="relative" onClick={() => setCartOpen(true)}><ShoppingBag className="size-5" />{cartCount > 0 && <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-[#1e201f] text-[9px] text-white">{cartCount}</span>}</button>
          </div>
        </div>
      </header>

      {mobileMenu && <div className="fixed inset-0 z-50 bg-[#f7f6f3] p-6 lg:hidden"><div className="flex items-center justify-between"><span className="font-serif text-4xl italic">Morchi</span><button aria-label="Cerrar menú" onClick={() => setMobileMenu(false)}><X /></button></div><nav className="mt-20 flex flex-col gap-7 text-2xl font-medium">{['Novedades', 'Remeras', 'Pantalones', 'Calzado', 'Sale'].map((item) => <button className="text-left" key={item} onClick={() => { setCategory(item === 'Remeras' ? 'Remeras' : 'Todo'); setMobileMenu(false) }}>{item}</button>)}</nav></div>}

      <section id="inicio" className="mx-auto grid max-w-[1400px] gap-5 px-5 pb-14 pt-5 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:pt-8">
        <div className="relative min-h-[520px] overflow-hidden bg-[#d7d2c8] lg:min-h-[650px]"><img src={images.hero} alt="Campaña Morchi con dos modelos" className="absolute inset-0 size-full object-cover object-center grayscale-[20%]" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5" /><div className="absolute bottom-8 left-7 text-white sm:bottom-12 sm:left-12"><p className="mb-3 text-[10px] uppercase tracking-[0.28em]">Colección 01 — 2025</p><h1 className="max-w-lg text-5xl font-medium leading-[0.92] tracking-[-0.06em] sm:text-7xl">Vestite de lo que sos.</h1><button onClick={() => document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' })} className="mt-7 border border-white px-6 py-3 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-white hover:text-black">Ver colección</button></div></div>
        <div className="flex min-h-[420px] flex-col justify-between bg-[#d9e0d8] p-7 lg:min-h-[650px] lg:p-10"><div><p className="text-[10px] uppercase tracking-[0.28em]">Morchi essentials</p><h2 className="mt-5 max-w-sm text-4xl font-medium leading-[0.95] tracking-[-0.05em] lg:text-6xl">Básicos, pero nunca básicos.</h2></div><div className="relative mt-10 flex flex-1 items-end justify-center overflow-hidden"><img src={images.blackTee} alt="Remera negra oversized Morchi" className="h-full max-h-[370px] w-full object-cover object-top mix-blend-multiply" /><span className="absolute bottom-5 left-5 rounded-full bg-[#f7f6f3] px-4 py-2 text-[10px] uppercase tracking-[0.16em]">Comprar esenciales</span></div></div>
      </section>

      <section id="productos" className="mx-auto max-w-[1400px] px-5 py-12 lg:px-10 lg:py-20"><div className="mb-8 flex flex-col justify-between gap-5 border-b border-black/15 pb-5 sm:flex-row sm:items-end"><div><p className="text-[10px] uppercase tracking-[0.28em] text-black/55">Selección Morchi</p><h2 className="mt-2 text-4xl tracking-[-0.05em]">Lo nuevo</h2></div><div className="flex items-center gap-5"><div className="hidden items-center gap-4 text-xs sm:flex">{['Todo', 'Remeras', 'Pantalones'].map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? 'border-b border-black pb-1' : 'text-black/45'}>{item}</button>)}</div><button className="flex items-center gap-2 text-xs uppercase tracking-[0.12em]"><SlidersHorizontal className="size-4" /> Filtrar</button></div></div><div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">{visibleProducts.map((product, index) => <article key={product.name} className="group"><div className="relative aspect-[0.8] overflow-hidden bg-[#e9e7e1]"><img src={product.image} alt={product.name} className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />{product.tag && <span className="absolute left-3 top-3 bg-[#f7f6f3] px-2 py-1 text-[9px] uppercase tracking-[0.14em]">{product.tag}</span>}<button aria-label={`Agregar ${product.name} a favoritos`} className="absolute right-3 top-3 rounded-full bg-[#f7f6f3]/85 p-2 opacity-0 transition-opacity group-hover:opacity-100"><Heart className="size-4" /></button><button onClick={addToCart} className="absolute bottom-3 left-3 right-3 bg-[#f7f6f3] py-3 text-[10px] uppercase tracking-[0.14em] opacity-0 transition-opacity group-hover:opacity-100">Agregar al carrito</button></div><div className="pt-3"><div className="flex justify-between gap-2 text-sm"><h3>{product.name}</h3><span>{formatPrice(product.price)}</span></div><p className="mt-1 text-xs text-black/50">{product.category} · {product.color}</p></div></article>)}</div></section>

      <section className="mx-5 mb-16 overflow-hidden bg-[#1e201f] text-[#f7f6f3] lg:mx-10"><div className="grid items-center lg:grid-cols-2"><div className="order-2 p-8 sm:p-14 lg:order-1"><p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Nuestra mirada</p><h2 className="mt-5 max-w-lg text-4xl leading-[0.95] tracking-[-0.06em] sm:text-6xl">Hecho para moverte, hecho para durar.</h2><p className="mt-7 max-w-md text-sm leading-6 text-white/65">Diseñamos prendas que acompañan tu ritmo. Materiales nobles, calces cómodos y una estética que habla por vos.</p><button className="mt-9 flex items-center gap-3 border-b border-white pb-2 text-xs uppercase tracking-[0.16em]">Conocé Morchi <ChevronRight className="size-4" /></button></div><img src={images.campaign} alt="Detalle de la identidad visual de Morchi" className="order-1 h-[420px] w-full object-cover lg:order-2 lg:h-[520px]" /></div></section>

      {cartOpen && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setCartOpen(false)}><aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#f7f6f3] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-black/15 pb-5"><h2 className="text-2xl tracking-[-0.04em]">Tu carrito <span className="text-sm text-black/50">({cartCount})</span></h2><button aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}><X /></button></div>{cartCount === 0 ? <div className="flex flex-1 flex-col items-center justify-center text-center"><ShoppingBag className="mb-5 size-8 stroke-1" /><p className="text-sm">Tu carrito está vacío.</p><button onClick={() => setCartOpen(false)} className="mt-6 border-b border-black pb-1 text-xs uppercase tracking-[0.14em]">Seguir comprando</button></div> : <div className="flex flex-1 flex-col"><div className="flex gap-4 border-b border-black/15 py-6"><img src={images.blackTee} alt="Remera Essential" className="size-24 object-cover" /><div className="flex flex-1 flex-col justify-between"><div className="flex justify-between"><div><p className="text-sm">Remera Essential</p><p className="mt-1 text-xs text-black/50">Negro · M</p></div><span className="text-sm">{formatPrice(28900)}</span></div><div className="flex items-center gap-4 text-xs"><button onClick={() => setCartCount(Math.max(0, cartCount - 1))} className="rounded-full border border-black/20 px-2">−</button><span>{cartCount}</span><button onClick={() => setCartCount(cartCount + 1)} className="rounded-full border border-black/20 px-2">+</button></div></div></div><div className="mt-auto border-t border-black/15 pt-5"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(28900 * cartCount)}</span></div><p className="mt-2 text-xs text-black/50">Envío calculado en el checkout.</p><button className="mt-6 w-full bg-[#1e201f] py-4 text-xs uppercase tracking-[0.16em] text-white">Iniciar compra</button></div></div>}</aside></div>}

      <footer className="border-t border-black/10 px-5 py-8 lg:px-10"><div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-5 text-xs text-black/55 sm:flex-row"><span className="font-serif text-2xl italic text-[#1e201f]">Morchi</span><span>Buenos Aires, Argentina · © 2025 Morchi</span><div className="flex gap-5"><a href="#inicio">Instagram</a><a href="#inicio">Contacto</a></div></div></footer>
    </main>
  )
}
