'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signInAdmin(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) redirect('/admin/login?error=credentials')
  if (data.user.app_metadata?.role !== 'admin') {
    await supabase.auth.signOut()
    redirect('/admin/login?error=access')
  }
  redirect('/admin')
}

export async function signOutAdmin() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
