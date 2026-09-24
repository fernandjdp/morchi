'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getPublicSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente de Supabase para Client Components.
 *
 * Solo usa la clave publicable; el acceso queda limitado por RLS.
 */
export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv()
  return createBrowserClient<Database>(url, publishableKey)
}
