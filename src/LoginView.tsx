'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Fingerprint, Eye, EyeSlash, ArrowLeft } from '@phosphor-icons/react';
import { useApp } from './context/AppContext.tsx';
import { api, setToken } from './lib/api.ts';

export default function LoginView() {
  const { handleLogin } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password);
      setToken(result.token);
      handleLogin({
        id: result.user.id,
        email: result.user.email,
        password: '',
        name: result.user.name,
        role: result.user.role as 'docente' | 'estudiante',
        studentId: result.user.studentId,
      });
      router.push('/docente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.04),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_50%_50%,black_30%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
          Volver al inicio
        </Link>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent-600 flex items-center justify-center mb-4">
              <Fingerprint className="w-6 h-6 text-white" weight="fill" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">FaceAccess Lab</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Portal del Docente</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Correo institucional</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="docente@uide.edu.ec"
                className="w-full text-sm p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-caption font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full text-sm p-2.5 pr-10 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer">
                  {showPassword ? <EyeSlash className="w-4 h-4" weight="regular" /> : <Eye className="w-4 h-4" weight="regular" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-caption text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>

            <Link href="/recuperar" className="block w-full text-center text-caption font-semibold text-zinc-400 dark:text-zinc-500 hover:text-accent-600 dark:hover:text-accent-400 transition-all">
              ¿Olvidaste tu contraseña?
            </Link>
          </form>

          <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-label text-zinc-400 dark:text-zinc-500 text-center font-medium">
              Acceso exclusivo para personal docente autorizado.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
