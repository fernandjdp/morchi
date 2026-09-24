import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente de Supabase para Server Components, Server Functions y Route Handlers.
 *
 * Usa la sesión por cookies y respeta RLS (clave publicable). No debe usarse
 * para operaciones privilegiadas: para eso existe `lib/supabase/admin.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getPublicSupabaseEnv()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // `setAll` puede fallar cuando se llama desde un Server Component.
          // El middleware se encarga de refrescar la sesión en ese caso.
        }
      },
    },
  })
}
