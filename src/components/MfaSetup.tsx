'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Key, CircleNotch, CheckCircle, X } from '@phosphor-icons/react';
import { api, getToken } from '../lib/api.ts';

export default function MfaSetup() {
  const [secret, setSecret] = useState<string | null>(null);
  const [qrLabel, setQrLabel] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'setup' | 'enabled'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStatus = async () => {
    // Si ya hay token y setup pendiente, no lo re-consultamos; el usuario decide.
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.setupMfa();
      setSecret(res.secret);
      setQrLabel(res.qrLabel);
      setStatus('setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar MFA');
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.enableMfa(code);
      setStatus('enabled');
      setCode('');
      setNotice('MFA habilitado correctamente.');
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.disableMfa(code);
      setStatus('idle');
      setSecret(null);
      setCode('');
      setNotice('MFA deshabilitado.');
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setBusy(false);
    }
  };

  const totpUrl = secret
    ? `otpauth://totp/${encodeURIComponent(qrLabel)}?secret=${secret}&issuer=FaceAccessLab`
    : '';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
          Autenticación en dos pasos (MFA)
        </h4>
        <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${
          status === 'enabled' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
        }`}>
          {status === 'enabled' ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {notice && (
        <div role="status" className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-green-800 dark:text-green-300 font-medium">{notice}</p>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {status === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Protege tu cuenta de administrador con un código de 6 dígitos generado por una app autenticadora
            (Google Authenticator, Authy, 1Password). Se te pedirá al iniciar sesión.
          </p>
          <button
            onClick={handleSetup}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {busy ? <CircleNotch className="w-4 h-4 animate-spin" weight="bold" /> : <Key className="w-4 h-4" weight="regular" />}
            Configurar MFA
          </button>
        </div>
      )}

      {status === 'setup' && secret && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Escanea el código QR en tu app autenticadora (usa la URL o el secreto manual) y luego ingresa el código de 6 dígitos para confirmar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center justify-center">
              {/* QR simplificado: mostramos la URL otpauth como alternativa sin librería QR */}
              <div className="w-40 h-40 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-center p-3">
                <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 break-all leading-relaxed">{totpUrl}</p>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">Secreto manual</p>
              <code className="block text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 select-all break-all">{secret}</code>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-32 text-center text-sm font-mono tracking-[0.5em] p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
            />
            <button
              onClick={handleEnable}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {busy && <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />}
              Activar MFA
            </button>
          </div>
          <p className="text-caption text-zinc-400 dark:text-zinc-500">Solo números (6 dígitos)</p>
        </div>
      )}

      {status === 'enabled' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            MFA está activo. Para desactivarlo, ingresa un código válido de tu app autenticadora.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-32 text-center text-sm font-mono tracking-[0.5em] p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
            <button
              onClick={handleDisable}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {busy && <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />}
              Desactivar MFA
            </button>
          </div>
          <p className="text-caption text-zinc-400 dark:text-zinc-500">Solo números (6 dígitos)</p>
        </div>
      )}
    </div>
  );
}
