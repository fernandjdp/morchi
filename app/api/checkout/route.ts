import { NextResponse } from 'next/server'

import { checkoutRequestSchema } from '@/features/checkout/schemas/checkout.schema'
import { createCheckout } from '@/features/checkout/services/create-checkout'
import { CheckoutError } from '@/features/checkout/services/checkout-error'

/**
 * POST /api/checkout
 *
 * Body: { items: [{ variant_id: uuid, quantity: number }], email: string }
 * Respuesta: { orderId, preferenceId, initPoint }
 *
 * Los precios y el stock se recalculan server-side; el cliente no los envía.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = checkoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const idempotencyKey =
      request.headers.get('idempotency-key') ?? parsed.data.idempotency_key

    const result = await createCheckout({
      ...parsed.data,
      idempotency_key: idempotencyKey ?? undefined,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof CheckoutError) {
      const conflict =
        error.code === 'insufficient_stock' || error.code === 'variant_not_buyable'
      return NextResponse.json(
        { error: error.code },
        { status: conflict ? 409 : 500 },
      )
    }

    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 })
  }
}
