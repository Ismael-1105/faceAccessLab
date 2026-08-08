'use client';

import { useEffect, useState } from 'react';
import { CircleNotch, ShieldCheck, WifiHigh, WifiSlash, Camera, Database, CheckCircle, XCircle } from '@phosphor-icons/react';
import type { SystemHealth } from '@/src/types';
import { getToken } from '@/src/lib/api';
import { peekQueue, queueSize } from '@/src/lib/kiosk-telemetry';

interface SessionInfo { subject: string; teacherName: string | null; startTime: string; endTime: string; status: string }

/** Página de diagnóstico protegida (técnicos). Acceso vía /docente o admin. */
export default function DiagnosticoPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [queue, setQueue] = useState(0);
  const [cameraOk, setCameraOk] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [error, setError] = useState('');
  // ISS-21: 'checking' hasta saber, para no anunciar un fallo que aun no consta.
  const [wasmOk, setWasmOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health', {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then(r => r.json())
      .then((h: SystemHealth) => { if (!cancelled) setHealth(h); })
      .catch(() => { if (!cancelled) setError('No se pudo contactar /api/health'); });

    fetch('/api/kiosk/session')
      .then(r => r.json())
      .then((d: { session: SessionInfo | null }) => { if (!cancelled) setSession(d.session); })
      .catch(() => {});

    // ISS-21: con output: 'standalone' el directorio public/ NO se incluye en la
    // salida del build. Si no se copia a mano, faltan los binarios de MediaPipe y
    // el disparo automatico del kiosco deja de funcionar en silencio. Aqui se
    // comprueba de forma explicita, antes de empezar y no en mitad del flujo.
    fetch('/mediapipe/wasm/vision_wasm_internal.wasm', { method: 'HEAD' })
      .then(r => { if (!cancelled) setWasmOk(r.ok); })
      .catch(() => { if (!cancelled) setWasmOk(false); });

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { setCameraOk(true); stream.getTracks().forEach(t => t.stop()); })
        .catch(() => setCameraOk(false));
    }

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => { setQueue(queueSize()); }, []);

  const rows: Array<{ label: string; ok: boolean; value: string }> = [
    { label: 'API', ok: Boolean(health?.ok), value: health?.ok ? 'OK' : 'No responde' },
    { label: 'MongoDB', ok: Boolean(health?.mongo?.connected), value: health?.mongo?.connected ? 'Conectado' : 'Sin conexión' },
    { label: 'AWS', ok: Boolean(health?.aws?.configured), value: health?.aws?.configured ? 'Configurado' : 'No configurado' },
    { label: 'Cámara', ok: cameraOk, value: cameraOk ? 'Disponible' : 'No accesible' },
    { label: 'Red', ok: online, value: online ? 'En línea' : 'Sin conexión' },
    {
      label: 'Runtime MediaPipe',
      ok: wasmOk === true,
      value: wasmOk === null
        ? 'Comprobando...'
        : wasmOk
          ? 'Disponible'
          : 'Ausente: sin disparo automático',
    },
    { label: 'Cola local', ok: queue === 0, value: `${queue} evento(s)` },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" weight="fill" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Diagnóstico del terminal</h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Página protegida para técnicos · FaceAccess Lab</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-300 font-medium">{error}</div>
        )}

        {!health ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" />
            <p className="text-sm">Comprobando componentes...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map(r => (
                <div key={r.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-label font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{r.label}</span>
                    {r.ok
                      ? <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />
                      : <XCircle className="w-5 h-5 text-red-500" weight="fill" />}
                  </div>
                  <p className={`mt-2 text-sm font-bold ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{r.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold mb-3">Clase vigente del laboratorio</h2>
              {session ? (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{session.subject}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">Docente: {session.teacherName ?? '—'} · {session.startTime}–{session.endTime} · {session.status}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin clase en curso en este horario.</p>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold mb-3">Cola local de eventos (no biométricos)</h2>
              {queue === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin eventos pendientes.</p>
              ) : (
                <ul className="space-y-1 text-xs font-mono">
                  {peekQueue().slice(-10).reverse().map((e, i) => (
                    <li key={i} className="text-zinc-600 dark:text-zinc-300">
                      {new Date(e.ts).toISOString()} · {e.event}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              {online ? <WifiHigh className="w-4 h-4" weight="fill" /> : <WifiSlash className="w-4 h-4" weight="fill" />}
              <Camera className="w-4 h-4" weight="fill" />
              <Database className="w-4 h-4" weight="fill" />
              Estado de red, cámara y base de datos en tiempo real.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
