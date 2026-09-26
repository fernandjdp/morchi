/**
 * Acceso centralizado a variables de entorno.
 *
 * Reglas (ARCHITECTURE.md §23 y constitución §IV):
 * - Las claves con prefijo NEXT_PUBLIC_ pueden llegar al navegador.
 * - Las claves secretas (Supabase secret key, Mercado Pago) son server-only.
 * - Nunca se imprimen valores de secretos en mensajes de error.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    // Solo se expone el nombre de la variable, nunca su valor.
    throw new Error(`Falta la variable de entorno requerida: ${name}`)
  }
  return value
}

function firstConfiguredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return requireEnv(names[0])
}

export function getPublicSupabaseEnv() {
  return {
    // Supabase integrations may expose either the NEXT_PUBLIC_* names or the
    // provider names. Support both so the server and browser use the same
    // connected project in previews and deployments.
    url: firstConfiguredEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    publishableKey: firstConfiguredEnv(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY',
    ),
  }
}

export function getServerSupabaseEnv() {
  return {
    secretKey: firstConfiguredEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  }
}

export function getMercadoPagoEnv() {
  return {
    accessToken: requireEnv('MERCADOPAGO_ACCESS_TOKEN'),
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  }
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}
