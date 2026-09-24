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

export function getPublicSupabaseEnv() {
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  }
}

export function getServerSupabaseEnv() {
  return {
    secretKey: requireEnv('SUPABASE_SECRET_KEY'),
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
