'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/features/backoffice/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function adjustInventory(formData: FormData) {
  const actor = await requireAdmin()
  const input = z.object({ variant_id: z.string().uuid(), delta: z.coerce.number().int().min(-100000).max(100000).refine(v=>v!==0), note: z.string().trim().min(3).max(300) }).safeParse(Object.fromEntries(formData))
  if (!input.success) redirect('/admin/inventario?error=validation')
  const supabase = createAdminClient()
  const { error } = await (supabase as any).rpc('admin_adjust_inventory', {
    p_variant_id: input.data.variant_id, p_delta: input.data.delta,
    p_note: input.data.note, p_actor_id: actor.id,
  })
  if (error) redirect(`/admin/inventario?error=${error.message === 'insufficient_stock' ? 'stock' : 'save'}`)
  revalidatePath('/admin/inventario')
  revalidatePath('/admin')
  redirect('/admin/inventario?saved=1')
}
