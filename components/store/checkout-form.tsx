'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { checkoutCartAction } from '@/features/checkout/actions/checkout-actions'

const errorMessages: Record<string, string> = {
  empty_cart: 'Tu carrito está vacío.',
  insufficient_stock: 'Uno de los productos ya no tiene stock suficiente.',
  variant_not_buyable: 'Uno de los productos ya no está disponible.',
  email_required: 'Ingresá un email válido.',
  checkout_failed: 'No pudimos iniciar el pago. Intentá de nuevo.',
}

export function CheckoutForm({ disabled }: { disabled?: boolean }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const idempotencyKey = useRef<string | null>(null)

  useEffect(() => {
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID()
    }
  }, [])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await checkoutCartAction(email, idempotencyKey.current ?? undefined)

      if (result.ok) {
        if (result.initPoint) {
          window.location.href = result.initPoint
          return
        }
        setError(`Pedido N° ${result.orderId} creado. Reintentá para continuar el pago.`)
        return
      }

      setError(errorMessages[result.error] ?? 'No pudimos iniciar el pago.')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-[0.14em] text-black/60">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          autoComplete="email"
          className="mt-2 w-full rounded-full border border-black/20 bg-white/70 px-5 py-3 text-sm outline-none focus:border-[#24635b]"
        />
      </label>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending || disabled}
        className="w-full rounded-full bg-[#24635b] py-4 text-xs uppercase tracking-[0.16em] text-white disabled:opacity-50"
      >
        {pending ? 'Generando pago…' : 'Ir a pagar'}
      </button>
    </form>
  )
}
