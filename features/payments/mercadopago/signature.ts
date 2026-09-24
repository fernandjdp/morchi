import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

export type MercadoPagoSignatureInput = {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string
}

/**
 * Valida la firma `x-signature` de un webhook de Mercado Pago.
 *
 * El header tiene la forma `ts=<epoch>,v1=<hmac>`. El manifest firmado es:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * (Mercado Pago, notificaciones webhook).
 */
export function isValidMercadoPagoSignature(input: MercadoPagoSignatureInput): boolean {
  const { xSignature, xRequestId, dataId, secret } = input

  if (!secret || !xSignature || !dataId) return false

  const parts = parseSignatureHeader(xSignature)
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()

  let received: Buffer
  try {
    received = Buffer.from(v1, 'hex')
  } catch {
    return false
  }

  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

function parseSignatureHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const segment of header.split(',')) {
    const separator = segment.indexOf('=')
    if (separator === -1) continue
    const key = segment.slice(0, separator).trim()
    const value = segment.slice(separator + 1).trim()
    if (key) result[key] = value
  }
  return result
}
