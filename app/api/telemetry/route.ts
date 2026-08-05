import { z } from 'zod';
import { corsOptions } from '@/lib/cors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { checkDistributedRateLimit, getClientAddress } from '@/lib/distributed-rate-limit';
import { logger } from '@/lib/observability';

export function OPTIONS(req: Request) {
  return corsOptions(req);
}

const telemetrySchema = z.object({
  events: z.array(
    z.object({
      event: z.string().min(1).max(80),
      ts: z.number().int().positive(),
      meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
  ).max(50),
}).strict();

/**
 * POST /api/telemetry
 * Recibe la cola local de eventos NO biométricos del kiosco (Fase 7).
 * Solo se registran de forma estructurada; no se aceptan imágenes, tokens ni
 * datos faciales (el schema y el logger lo bloquean).
 */
export async function POST(req: Request) {
  const ip = getClientAddress(req);
  if (!await checkDistributedRateLimit(`telemetry:${ip}`, RATE_LIMITS.login)) {
    return new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    });
  }

  const raw = await req.json().catch(() => null);
  const parsed = telemetrySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return new Response(JSON.stringify({ ok: false, error: 'Payload inválido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const e of parsed.data.events) {
    logger.info('kiosk.telemetry', { event: e.event, ts: e.ts, ...(e.meta ?? {}) });
  }

  return new Response(JSON.stringify({ ok: true, received: parsed.data.events.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
