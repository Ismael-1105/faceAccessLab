'use client';

import React, { useEffect, useState } from 'react';
import { Camera, CircleNotch, ArrowSquareOut, MagnifyingGlass, ShieldWarning } from '@phosphor-icons/react';
import type { DenialEvidence } from '../types.ts';
import { api } from '../lib/api.ts';

export default function EvidenceView() {
  const [evidence, setEvidence] = useState<DenialEvidence[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setEvidence(await api.getEvidence());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar evidencia');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPhoto = async (key: string) => {
    try {
      const { url } = await api.getEvidencePhotoUrl(key);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la foto');
    }
  };

  const filtered = evidence.filter(e =>
    (e.reason || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.labCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.kioskId || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Evidencia de Accesos Denegados</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Fotografías capturadas automáticamente cuando un acceso fue rechazado.</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <ShieldWarning className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      <div className="relative w-full sm:max-w-xs">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
        <input type="text" placeholder="Buscar por motivo, lab o kiosco..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all" />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
              <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
              <p className="text-sm">Cargando evidencia...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
              <Camera className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {evidence.length === 0 ? 'Aún no hay evidencia de denegados' : 'Sin resultados para la búsqueda'}
              </p>
              <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Los accesos denegados capturan una foto automáticamente.</p>
            </div>
          ) : (
            <table aria-label="Evidencia de denegados" className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">Lab</th>
                  <th className="p-4">Kiosco</th>
                  <th className="p-4 text-center">Confianza</th>
                  <th className="p-4 text-center">Foto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => (
                  <tr key={ev.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 font-mono text-zinc-500 dark:text-zinc-400">{formatDate(ev.createdAt)}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-mono font-bold">{ev.reason}</span>
                    </td>
                    <td className="p-4 font-mono text-zinc-500 dark:text-zinc-400">{ev.labCode || '—'}</td>
                    <td className="p-4 font-mono text-zinc-500 dark:text-zinc-400">{ev.kioskId || '—'}</td>
                    <td className="p-4 text-center font-mono text-zinc-600 dark:text-zinc-300">{ev.confidence > 0 ? `${ev.confidence.toFixed(1)}%` : '—'}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => openPhoto(ev.photoKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-950/50 transition-all cursor-pointer">
                        <ArrowSquareOut className="w-3.5 h-3.5" weight="regular" />
                        Ver foto
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
