const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;

// Límites configurables por entorno (sin recompilar para ajustar en producción).
function envMax(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const RATE_LIMITS = {
  login: envMax('RATE_LIMIT_LOGIN', 5),
  compare: envMax('RATE_LIMIT_COMPARE', 10),
  sts: envMax('RATE_LIMIT_STS', 6),
  register: envMax('RATE_LIMIT_REGISTER', 10),
};

export function checkRateLimit(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    if (rateLimitStore.size > 50_000) {
      // Red de seguridad: evita crecimiento sin límite en memoria.
      for (const [k, e] of rateLimitStore) {
        if (now > e.resetAt) rateLimitStore.delete(k);
      }
      if (rateLimitStore.size > 60_000) rateLimitStore.clear();
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Limpieza cada 30s de entradas expiradas.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 30_000);
