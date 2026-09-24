import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CheckoutForm } from '@/components/store/checkout-form'
import { getCart } from '@/features/cart/services/cart-service'

export const dynamic = 'force-dynamic'

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`

export default async function CheckoutPage() {
  const cart = await getCart()
  if (!cart || cart.lines.length === 0) redirect('/productos')

  return (
    <main className="min-h-screen bg-[#f9e6d7] text-[#24635b]">
      <div className="mx-auto max-w-2xl px-5 py-14 lg:px-10">
        <Link
          href="/productos"
          className="text-xs uppercase tracking-[0.14em] text-black/50 hover:opacity-70"
        >
          ← Seguir comprando
        </Link>

        <h1 className="mt-6 text-4xl tracking-[-0.05em]">Checkout</h1>

        <section className="mt-8 rounded-[1.5rem] border border-black/10 bg-white/40 p-6">
          <h2 className="text-sm uppercase tracking-[0.14em] text-black/60">Tu pedido</h2>
          <ul className="mt-4 divide-y divide-black/10">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4 py-3 text-sm">
                <span>
                  {line.productName}{' '}
                  <span className="text-black/50">× {line.quantity}</span>
                </span>
                <span>{formatPrice(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-black/15 pt-4 text-sm font-medium">
            <span>Subtotal</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          {cart.hasIssues && (
            <p className="mt-3 text-xs text-red-700">
              Alguno de los productos ya no tiene stock suficiente. Ajustá el carrito antes de
              continuar.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-black/10 bg-white/40 p-6">
          <h2 className="text-sm uppercase tracking-[0.14em] text-black/60">
            Datos de contacto
          </h2>
          <p className="mt-2 text-xs text-black/50">
            Usamos tu email para asociar el pedido y enviarte el comprobante.
          </p>
          <div className="mt-5">
            <CheckoutForm disabled={cart.hasIssues} />
          </div>
        </section>
      </div>
    </main>
  )
}
