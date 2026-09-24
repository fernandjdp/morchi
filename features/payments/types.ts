export type PaymentStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'unknown'

export type CreatePreferenceItem = {
  id: string
  title: string
  quantity: number
  unitPrice: number
  currencyId: string
}

export type CreatePreferenceInput = {
  orderId: string
  items: CreatePreferenceItem[]
  payerEmail?: string | null
  notificationUrl: string
}

export type CreatePreferenceResult = {
  preferenceId: string
  initPoint: string | null
}

export type ProviderPayment = {
  id: string
  status: PaymentStatus
  statusDetail: string | null
  externalReference: string | null
  amount: number | null
  currency: string | null
  paidAt: string | null
  raw: unknown
}

/**
 * Contrato de proveedor de pagos (ARCHITECTURE.md §15).
 * El dominio de checkout depende de esta interfaz, no del SDK de Mercado Pago.
 */
export interface PaymentProvider {
  createPreference(input: CreatePreferenceInput): Promise<CreatePreferenceResult>
  getPayment(paymentId: string): Promise<ProviderPayment>
}
