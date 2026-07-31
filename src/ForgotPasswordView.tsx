'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Fingerprint, ArrowLeft, CheckCircle, Envelope } from '@phosphor-icons/react';
import { MOCK_AUTH_USERS } from './data.ts';

export default function ForgotPasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const exists = MOCK_AUTH_USERS.find(
      u => u.email === email && (u.role === 'admin' || u.role === 'docente')
    );

    if (exists) {
      setSent(true);
    } else {
      setError('No encontramos una cuenta docente con ese correo.');
    }
  };

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
              {sent
                ? 'Revisa tu bandeja de entrada para restablecer tu acceso.'
                : 'Ingresa tu correo institucional y te enviaremos un enlace.'}
            </p>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" weight="fill" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Correo enviado</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Si <span className="font-mono text-accent-500">{email}</span> está registrado, recibirás las instrucciones en unos minutos.
                </p>
              </div>
              <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 w-full text-center">
                <p className="text-label text-zinc-400 dark:text-zinc-500 font-mono">
                  Modo demostración — el correo no se envió realmente.
                </p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-600 dark:text-accent-400 hover:underline transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
                Volver al inicio de sesión
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-caption font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Correo institucional
                </label>
                <div className="relative">
                  <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="docente@faceaccess.lab"
                    className="w-full text-sm p-2.5 pl-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-caption text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                className="w-full bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all cursor-pointer"
              >
                Enviar enlace
              </button>

<button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
                Volver al inicio de sesión
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

