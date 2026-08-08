'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Fingerprint, ArrowLeft, Info } from '@phosphor-icons/react';

/**
 * ISS-14. Esta pantalla validaba el correo contra una lista simulada del
 * cliente, de modo que rechazaba a docentes reales y confirmaba un envío que
 * nunca ocurría. Además permitía enumerar qué cuentas existían.
 *
 * El restablecimiento de contraseña no está implementado en esta versión, así
 * que la pantalla lo dice en lugar de simularlo. No hay campo de correo ni
 * respuesta que dependa de lo introducido: no hay nada que enumerar.
 */
export default function ForgotPasswordView() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.04),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_50%_50%,black_30%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent-600 flex items-center justify-center mb-4">
              <Fingerprint className="w-6 h-6 text-white" weight="fill" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
              Recuperar contraseña
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center">
              Funcionalidad no disponible en esta versión.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Info className="w-8 h-8 text-amber-600 dark:text-amber-400" weight="fill" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                El restablecimiento de contraseña aún no está disponible
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Esta versión no envía correos de recuperación. Para restablecer tu acceso,
                solicítalo al administrador del laboratorio, que puede asignarte una
                contraseña nueva desde el panel de usuarios.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-accent-600 dark:text-accent-400 hover:underline transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

