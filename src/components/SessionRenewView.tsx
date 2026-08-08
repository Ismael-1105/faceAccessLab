'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleNotch } from '@phosphor-icons/react';
import { attemptRefresh } from '../lib/api.ts';

/**
 * Solo se acepta como destino una ruta interna de esta aplicación.
 *
 * `//evil.com` empieza por barra pero el navegador lo trata como protocolo
 * relativo y sale del dominio. Esto es una ruta de autenticación, de modo que un
 * redirector abierto aquí serviría para llevarse una sesión recién renovada.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/docente';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/docente';
  return raw;
}

/**
 * ISS-22. Renueva la sesión y devuelve al destino original.
 *
 * `proxy.ts` manda aquí cuando el access token caducó pero la cookie de refresco
 * sigue viva. La rotación no puede hacerla el middleware: `authService.refresh`
 * exige CSRF por cabecera y una redirección es una navegación, que no puede
 * enviar cabeceras personalizadas. Un `fetch` sí, y `attemptRefresh` ya adjunta
 * `X-CSRF-Token` leyendo la cookie `csrf_token`, que no es HttpOnly y vive 7
 * días, así que sigue disponible cuando el access token ya expiró.
 */
export default function SessionRenewView() {
  const router = useRouter();
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);
  // En React 18 en modo estricto el efecto corre dos veces: sin esto se
  // dispararían dos rotaciones de refresh token para una sola visita.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const next = safeNext(params.get('next'));

    attemptRefresh()
      .then(ok => {
        if (ok) {
          router.replace(next);
          return;
        }
        // Nunca de vuelta al destino: proxy.ts volvería a mandar aquí y se
        // montaría un bucle de redirecciones entre las dos.
        setFailed(true);
        router.replace('/login');
      })
      .catch(() => {
        setFailed(true);
        router.replace('/login');
      });
  }, [params, router]);

  return (
    <div className="min-h-screen bg-surface dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
        {!failed && <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />}
        <p className="text-sm">
          {failed ? 'La sesión expiró. Redirigiendo al inicio de sesión...' : 'Renovando sesión...'}
        </p>
      </div>
    </div>
  );
}
