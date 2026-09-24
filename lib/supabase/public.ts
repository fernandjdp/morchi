import { createClient } from '@supabase/supabase-js'

import { getPublicSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente de Supabase para lecturas públicas y cacheables.
 *
 * No usa cookies ni sesión, por lo que puede ejecutarse en Server Components
 * con caching/revalidación (ARCHITECTURE.md §13). El acceso sigue limitado por
 * RLS con la clave publicable.
 */
export function createPublicClient() {
  const { url, publishableKey } = getPublicSupabaseEnv()

  return createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
