'use client';

import React, { useEffect, useState } from 'react';
import {
  Scroll, CircleNotch, MagnifyingGlass, ShieldCheck, UserPlus, Trash,
  Flask, PencilSimple, Database, ShieldWarning,
} from '@phosphor-icons/react';
import type { AuditLogEntry } from '../types.ts';
import { api } from '../lib/api.ts';

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  'user.create': { label: 'Creó docente', icon: UserPlus, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
  'user.delete': { label: 'Eliminó docente', icon: Trash, color: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
  'lab.create': { label: 'Creó laboratorio', icon: Flask, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
  'lab.update': { label: 'Editó laboratorio', icon: PencilSimple, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
  'lab.delete': { label: 'Eliminó laboratorio', icon: Trash, color: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
  'student.create': { label: 'Matriculó estudiante', icon: Database, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
  'student.delete': { label: 'Eliminó estudiante', icon: Trash, color: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
  'student.toggle': { label: 'Cambió estado de alumno', icon: ShieldWarning, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
};

export default function AuditView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter(l =>
    l.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Auditoría</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
          Trazabilidad de las acciones administrativas realizadas por el equipo docente.
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <ShieldWarning className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      <div className="relative w-full sm:max-w-xs">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
        <input
          type="text"
          placeholder="Buscar en auditoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all duration-200"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
            <p className="text-sm">Cargando auditoría...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
            <Scroll className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {logs.length === 0 ? 'Aún no hay acciones registradas' : 'Sin resultados para la búsqueda'}
            </p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">
              {logs.length === 0 ? 'Las acciones de creación, edición y eliminación quedarán registradas aquí.' : 'Prueba con otro término.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(log => {
              const meta = ACTION_META[log.action] || { label: log.action, icon: ShieldCheck, color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' };
              const Icon = meta.icon;
              return (
                <div key={String(log.id)} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon className="w-4 h-4" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900 dark:text-white text-sm">{meta.label}</span>
                      <span className="font-mono text-label text-zinc-400 dark:text-zinc-500">{log.actorEmail}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 break-words">{log.details}</p>
                    )}
                    <p className="text-caption font-mono text-zinc-400 dark:text-zinc-500 mt-1">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
