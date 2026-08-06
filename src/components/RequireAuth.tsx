'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext.tsx';

/**
 * Guard de rutas protegidas: mientras la sesión se restaura (o tras cerrarla)
 * muestra un estado de carga y, si no hay usuario autenticado, redirige al login.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, sessionReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && !user) {
      router.replace('/login');
    }
  }, [sessionReady, user, router]);

  if (!sessionReady) {
    return (
      <div className="pt-20 p-8 text-center">
        <p className="text-zinc-500">Cargando sesión...</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
