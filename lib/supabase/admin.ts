import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getPublicSupabaseEnv, getServerSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente administrativo de Supabase (bypass de RLS).
 *
 * Solo puede importarse desde código server-only. `server-only` hace fallar el
 * build si este módulo llega al bundle del navegador (constitución §IV).
 *
 * Usar exclusivamente en operaciones privilegiadas: checkout, webhooks e
 * integraciones que no pueden depender de una sesión de usuario.
 */
export function createAdminClient() {
  const { url } = getPublicSupabaseEnv()
  const { secretKey } = getServerSupabaseEnv()

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
