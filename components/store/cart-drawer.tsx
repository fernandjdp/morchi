'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, X } from 'lucide-react'

import {
  removeCartItemAction,
  updateCartItemAction,
} from '@/features/cart/actions/cart-actions'
import type { Cart } from '@/features/cart/types'

const formatPrice = (price: number) => `$${price.toLocaleString('es-AR')}`

const errorMessages: Record<string, string> = {
  insufficient_stock: 'No hay stock suficiente para esa cantidad.',
  invalid_quantity: 'La cantidad mínima es 1.',
  item_not_found: 'Ese producto ya no está en el carrito.',
  cart_unavailable: 'No pudimos actualizar el carrito.',
}

type CartDrawerProps = {
  cart: Cart | null
  onClose: () => void
  onCartChange: (cart: Cart) => void
}

export function CartDrawer({ cart, onClose, onCartChange }: CartDrawerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const lines = cart?.lines ?? []

  const changeQuantity = (itemId: string, quantity: number) => {
    setError(null)
    startTransition(async () => {
      const result =
        quantity < 1
          ? await removeCartItemAction(itemId)
          : await updateCartItemAction(itemId, quantity)

      if (result.ok) {
        onCartChange(result.cart)
      } else {
        setError(errorMessages[result.error] ?? 'No pudimos actualizar el carrito.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose}>
      <aside
        aria-label="Carrito de compras"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#f9e6d7] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/15 pb-5">
          <h2 className="text-2xl tracking-[-0.04em]">
            Tu carrito <span className="text-sm text-black/50">({cart?.itemCount ?? 0})</span>
          </h2>
          <button aria-label="Cerrar carrito" onClick={onClose}>
            <X />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <ShoppingBag className="mb-5 size-8 stroke-1" />
            <p className="text-sm">Tu carrito está vacío.</p>
            <button
              onClick={onClose}
              className="mt-6 border-b border-black pb-1 text-xs uppercase tracking-[0.14em]"
            >
              Seguir comprando
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {lines.map((line) => (
                <div key={line.id} className="flex gap-4 border-b border-black/15 py-5">
                  {line.imageUrl && (
                    <img
                      src={line.imageUrl}
                      alt={line.productName}
                      className="size-20 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col justify-between gap-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm">{line.productName}</p>
                        <p className="mt-1 text-xs text-black/50">
                          {line.variantDescription ?? line.sku}
                        </p>
                        {!line.isValid && (
                          <p className="mt-1 text-xs text-red-700">
                            Sin stock suficiente ({line.available} disponibles)
                          </p>
                        )}
                      </div>
                      <span className="text-sm">{formatPrice(line.lineTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          aria-label="Reducir cantidad"
                          disabled={pending}
                          onClick={() => changeQuantity(line.id, line.quantity - 1)}
                          className="rounded-full border border-black/20 px-2 disabled:opacity-50"
                        >
                          −
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          aria-label="Aumentar cantidad"
                          disabled={pending || line.quantity >= line.available}
                          onClick={() => changeQuantity(line.id, line.quantity + 1)}
                          className="rounded-full border border-black/20 px-2 disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => changeQuantity(line.id, 0)}
                        disabled={pending}
                        className="text-xs text-black/50 underline underline-offset-4 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="pt-3 text-xs text-red-700">{error}</p>}

            <div className="border-t border-black/15 pt-5">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(cart?.subtotal ?? 0)}</span>
              </div>
              <p className="mt-2 text-xs text-black/50">
                El precio final y el stock se confirman al iniciar el pago.
              </p>
              <button
                onClick={() => router.push('/checkout')}
                disabled={pending || (cart?.hasIssues ?? false)}
                className="mt-6 w-full rounded-full bg-[#24635b] py-4 text-xs uppercase tracking-[0.16em] text-white disabled:opacity-50"
              >
                Iniciar compra
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
