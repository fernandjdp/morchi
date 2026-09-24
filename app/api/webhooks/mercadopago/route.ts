import { NextResponse } from 'next/server'

import { processMercadoPagoWebhook } from '@/features/payments/services/process-webhook'

/**
 * POST /api/webhooks/mercadopago
 *
 * Notificación server-to-server de Mercado Pago. La autenticidad se valida con
 * `x-signature` y el pago se reconsulta contra el proveedor.
 */
export async function POST(request: Request) {
  const url = new URL(request.url)

  let bodyPaymentId: string | null = null
  try {
    const body = (await request.json()) as { data?: { id?: unknown } } | null
    if (body?.data?.id !== undefined && body.data.id !== null) {
      bodyPaymentId = String(body.data.id)
    }
  } catch {
    // Mercado Pago también puede notificar solo por query string.
  }

  const paymentId =
    url.searchParams.get('data.id') ??
    url.searchParams.get('id') ??
    bodyPaymentId

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  try {
    const outcome = await processMercadoPagoWebhook({
      paymentId,
      xSignature,
      xRequestId,
    })

    if (outcome === 'invalid_signature') {
      return NextResponse.json({ received: false }, { status: 401 })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch {
    // Se devuelve 5xx para que Mercado Pago reintente la notificación.
    return NextResponse.json({ received: false }, { status: 500 })
  }
}
