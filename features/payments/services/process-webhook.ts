import 'server-only'

import { getMercadoPagoEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { mercadoPagoProvider } from '@/features/payments/mercadopago/client'
import { isValidMercadoPagoSignature } from '@/features/payments/mercadopago/signature'
import type { Json } from '@/types/database.types'

export type WebhookInput = {
  paymentId: string | null
  xSignature: string | null
  xRequestId: string | null
}

export type WebhookOutcome =
  | 'processed'
  | 'ignored'
  | 'invalid_signature'
  | 'payment_not_found'

type AdminClient = ReturnType<typeof createAdminClient>

type LocalPaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'

/**
 * Procesa una notificación de Mercado Pago de forma idempotente.
 *
 * - Verifica la firma del webhook (constitución §IV).
 * - Reconsulta el pago contra el proveedor; nunca confía en el body.
 * - Valida importe y moneda antes de aprobar (SC-003).
 * - Repetir la misma notificación no duplica efectos (SC-002).
 */
export async function processMercadoPagoWebhook(input: WebhookInput): Promise<WebhookOutcome> {
  const { webhookSecret } = getMercadoPagoEnv()
  const isProduction = process.env.NODE_ENV === 'production'

  if (webhookSecret) {
    const valid = isValidMercadoPagoSignature({
      xSignature: input.xSignature,
      xRequestId: input.xRequestId,
      dataId: input.paymentId,
      secret: webhookSecret,
    })
    if (!valid) return 'invalid_signature'
  } else if (isProduction) {
    // Sin secreto configurado no se puede verificar: se rechaza en producción.
    return 'invalid_signature'
  }

  if (!input.paymentId) return 'ignored'

  const providerPayment = await mercadoPagoProvider.getPayment(input.paymentId)
  const orderId = providerPayment.externalReference
  if (!orderId) return 'ignored'

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, total, currency, payment_status, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return 'payment_not_found'

  const amountMatches =
    providerPayment.amount !== null &&
    Math.abs(Number(order.total) - providerPayment.amount) < 0.01
  const currencyMatches =
    providerPayment.currency !== null && providerPayment.currency === order.currency
  const consistent = amountMatches && currencyMatches

  const localStatus = consistent ? mapProviderStatus(providerPayment.status) : 'pending'

  await persistPayment(admin, {
    orderId,
    providerPaymentId: providerPayment.id,
    status: localStatus,
    amount: providerPayment.amount ?? Number(order.total),
    currency: providerPayment.currency ?? order.currency,
    paidAt: providerPayment.paidAt,
    raw: providerPayment.raw,
  })

  if (!consistent) {
    // Importe/moneda incompatibles: no se habilita el pedido automáticamente.
    await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId)
    return 'processed'
  }

  if (providerPayment.status === 'approved' && order.payment_status !== 'approved') {
    await admin
      .from('orders')
      .update({ payment_status: 'approved', status: 'confirmed' })
      .eq('id', orderId)
    await admin.rpc('confirm_order_inventory', { p_order_id: orderId })
    return 'processed'
  }

  if (
    (providerPayment.status === 'rejected' || providerPayment.status === 'cancelled') &&
    order.payment_status === 'pending'
  ) {
    await admin
      .from('orders')
      .update({ payment_status: providerPayment.status, status: 'cancelled' })
      .eq('id', orderId)
    await admin.rpc('release_order_inventory', { p_order_id: orderId })
    return 'processed'
  }

  return 'processed'
}

function mapProviderStatus(status: string): LocalPaymentStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

type PersistPaymentInput = {
  orderId: string
  providerPaymentId: string
  status: LocalPaymentStatus
  amount: number
  currency: string
  paidAt: string | null
  raw: unknown
}

async function persistPayment(admin: AdminClient, input: PersistPaymentInput): Promise<void> {
  const payload = {
    provider_payment_id: input.providerPaymentId,
    status: input.status,
    amount: input.amount,
    currency: input.currency,
    paid_at: input.paidAt,
    raw_response: input.raw as Json,
  }

  const { data: existing } = await admin
    .from('payments')
    .select('id')
    .eq('provider', 'mercadopago')
    .eq('provider_payment_id', input.providerPaymentId)
    .maybeSingle()

  if (existing) {
    await admin.from('payments').update(payload).eq('id', existing.id)
    return
  }

  const { data: pending } = await admin
    .from('payments')
    .select('id')
    .eq('order_id', input.orderId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pending) {
    await admin.from('payments').update(payload).eq('id', pending.id)
    return
  }

  await admin.from('payments').insert({
    order_id: input.orderId,
    provider: 'mercadopago',
    ...payload,
  })
}
