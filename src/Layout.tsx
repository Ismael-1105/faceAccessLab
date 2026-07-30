'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fingerprint, Moon, Sun, Camera, SignOut } from '@phosphor-icons/react';
import { useApp } from './context/AppContext.tsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, user, handleLogout } = useApp();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased bg-surface dark:bg-zinc-950 text-text-primary dark:text-zinc-100 transition-colors duration-300">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>
      <header className="fixed top-0 left-0 w-full z-50 h-16 flex items-center justify-between px-5 md:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-white" weight="fill" />
          </div>
          <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">FaceAccess</span>
          <span className="hidden sm:inline text-label font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase mt-0.5">Lab</span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 text-micro font-bold tracking-wider uppercase leading-none ml-1">
            UIDE
          </span>
        </Link>

        <nav aria-label="Navegación principal" className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
            title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          >
            {theme === 'light' ? <Moon className="w-[18px] h-[18px]" weight="regular" /> : <Sun className="w-[18px] h-[18px]" weight="regular" />}
          </button>

          {!user && (
            <button
              onClick={() => router.push('/kiosco')}
              className="ml-1 inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-[0.98] border border-zinc-200 dark:border-zinc-700 cursor-pointer"
              aria-label="Abrir kiosco de acceso"
            >
              <Camera className="w-3.5 h-3.5" weight="regular" />
              Kiosco
            </button>
          )}

          {user ? (
            <button
              onClick={() => { handleLogout(); router.push('/'); }}
              className="ml-1 inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-[0.98] border border-red-200 dark:border-red-800/40 cursor-pointer"
              aria-label="Cerrar sesión"
            >
              <SignOut className="w-3.5 h-3.5" weight="regular" />
              Salir
            </button>
          ) : null}
        </nav>
      </header>

      <div id="main-content" className="flex-grow">
        {children}
      </div>
    </div>
  );
}
