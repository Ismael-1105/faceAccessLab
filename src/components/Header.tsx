import React from 'react';
import { Fingerprint, SignIn, Moon, Sun, Camera } from '@phosphor-icons/react';
import { useApp } from '../context/AppContext.tsx';

interface HeaderProps {
  onLoginClick: () => void;
  onStudentKioskClick?: () => void;
}

export default function Header({ onLoginClick, onStudentKioskClick }: HeaderProps) {
  const { theme, toggleTheme } = useApp();

  return (
    <header className="fixed top-0 left-0 w-full z-50 h-16 flex items-center justify-between px-5 md:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
      {/* Brand */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-white" weight="fill" />
        </div>
        <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
          FaceAccess
        </span>
        <span className="hidden sm:inline text-label font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase mt-0.5">
          Lab
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {theme === 'light' ? <Moon className="w-[18px] h-[18px]" weight="regular" /> : <Sun className="w-[18px] h-[18px]" weight="regular" />}
        </button>

        {/* Kiosco */}
        {onStudentKioskClick && (
          <button
            onClick={onStudentKioskClick}
            className="ml-1 inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-[0.98] border border-zinc-200 dark:border-zinc-700"
          >
            <Camera className="w-3.5 h-3.5" weight="regular" />
            Kiosco
          </button>
        )}

        {/* Login */}
        <button
          onClick={onLoginClick}
          className="ml-1 inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-[0.98]"
        >
          <SignIn className="w-3.5 h-3.5" weight="bold" />
          Iniciar sesión
        </button>
      </div>
    </header>
  );
}

