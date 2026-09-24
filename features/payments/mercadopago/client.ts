import 'server-only'

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'

import { getMercadoPagoEnv } from '@/lib/env'
import type {
  CreatePreferenceInput,
  CreatePreferenceResult,
  PaymentProvider,
  PaymentStatus,
  ProviderPayment,
} from '@/features/payments/types'

function getClient(): MercadoPagoConfig {
  const { accessToken } = getMercadoPagoEnv()
  return new MercadoPagoConfig({ accessToken })
}

export const mercadoPagoProvider: PaymentProvider = {
  async createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult> {
    const preference = new Preference(getClient())

    const result = await preference.create({
      body: {
        items: input.items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: item.currencyId,
        })),
        external_reference: input.orderId,
        notification_url: input.notificationUrl,
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      },
    })

    return {
      preferenceId: String(result.id),
      initPoint: result.init_point ?? null,
    }
  },

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    const payment = new Payment(getClient())
    const result = await payment.get({ id: paymentId })

    return {
      id: String(result.id),
      status: normalizeStatus(result.status),
      statusDetail: result.status_detail ?? null,
      externalReference: result.external_reference ?? null,
      amount: result.transaction_amount ?? null,
      currency: result.currency_id ?? null,
      paidAt: result.date_approved ?? null,
      raw: result,
    }
  },
}

function normalizeStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
      return 'pending'
    default:
      return 'unknown'
  }
}
