import { z } from 'zod'

export const checkoutItemSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
})

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  email: z.string().email(),
  idempotency_key: z.string().min(8).max(128).optional(),
})

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>
