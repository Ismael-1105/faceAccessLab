import { connectDB } from './db.ts';
import { RateLimitBucket } from './models.ts';

const DEFAULT_WINDOW_MS = 60_000;

export function getClientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Ventana fija compartida por todas las instancias de Next.js. La actualización
 * es atómica: cada solicitud incrementa el mismo documento y decide usando el
 * contador devuelto por MongoDB.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<boolean> {
  await connectDB();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs * 2);
  const shouldReset = {
    $lt: [{ $ifNull: ['$windowStart', new Date(0)] }, cutoff],
  };

  const bucket = await RateLimitBucket.findOneAndUpdate(
    { key },
    [{
      $set: {
        windowStart: { $cond: [shouldReset, now, '$windowStart'] },
        count: {
          $cond: [
            shouldReset,
            1,
            { $add: [{ $ifNull: ['$count', 0] }, 1] },
          ],
        },
        expiresAt,
      },
    }],
    // Mongoose 8.6+/9 exige la opción para actualizaciones por pipeline.
    { upsert: true, new: true, updatePipeline: true },
  );

  return Boolean(bucket && bucket.count <= maxRequests);
}
