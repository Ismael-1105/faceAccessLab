import { Suspense } from 'react';
import SessionRenewView from '@/src/components/SessionRenewView';

/**
 * ISS-22. Ruta a la que proxy.ts envía cuando la sesión es renovable.
 *
 * Queda fuera de STAFF_PATHS y del matcher a propósito: si el middleware la
 * protegiera, se redirigiría a sí misma en bucle.
 *
 * El Suspense es obligatorio porque useSearchParams obliga a renderizado en
 * cliente; sin él, next build falla al prerenderizar esta página.
 */
export default function RenovandoPage() {
  return (
    <Suspense fallback={null}>
      <SessionRenewView />
    </Suspense>
  );
}
