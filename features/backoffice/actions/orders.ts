'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/features/backoffice/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const transitions: Record<string, string[]> = {
  unfulfilled: ['processing'], processing: ['packed'], packed: ['shipped'],
  shipped: ['delivered'], delivered: ['returned'], returned: [],
}

export async function updateFulfillment(formData: FormData) {
  const actor = await requireAdmin()
  const input = z.object({
    id: z.string().uuid(),
    status: z.enum(['unfulfilled','processing','packed','shipped','delivered','returned']),
    note: z.string().trim().max(500).optional(),
  }).safeParse(Object.fromEntries(formData))
  if (!input.success) redirect('/admin/pedidos')
  const supabase = createAdminClient()
  const { data: order } = await supabase.from('orders').select('fulfillment_status').eq('id', input.data.id).maybeSingle()
  if (!order || !transitions[order.fulfillment_status].includes(input.data.status)) redirect(`/admin/pedidos/${input.data.id}?error=transition`)
  const { data: changed, error } = await supabase.from('orders').update({ fulfillment_status: input.data.status }).eq('id', input.data.id).eq('fulfillment_status', order.fulfillment_status).select('id').maybeSingle()
  if (error || !changed) redirect(`/admin/pedidos/${input.data.id}?error=transition`)
  const service = supabase as any
  const { error: auditError } = await service.from('admin_order_activity').insert({
    order_id: input.data.id, actor_id: actor.id,
    previous_fulfillment_status: order.fulfillment_status,
    new_fulfillment_status: input.data.status,
    note: input.data.note || null,
  })
  if (auditError) {
    await supabase.from('orders').update({ fulfillment_status: order.fulfillment_status }).eq('id', input.data.id).eq('fulfillment_status', input.data.status)
    redirect(`/admin/pedidos/${input.data.id}?error=audit`)
  }
  revalidatePath('/admin/pedidos')
  revalidatePath(`/admin/pedidos/${input.data.id}`)
  revalidatePath('/admin')
  redirect(`/admin/pedidos/${input.data.id}?saved=1`)
}
