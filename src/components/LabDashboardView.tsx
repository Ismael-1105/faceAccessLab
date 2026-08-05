'use client';

import React, { useEffect, useState } from 'react';
import {
  Flask, CircleNotch, X, SignIn, XCircle, WarningOctagon, Timer,
  Users as UsersIcon, CheckCircle, Clock,
} from '@phosphor-icons/react';
import type { Lab, LabDashboard } from '../types.ts';
import { api } from '../lib/api.ts';

export default function LabDashboardView() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selected, setSelected] = useState('');
  const [dash, setDash] = useState<LabDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getLabs()
      .then(list => {
        setLabs(list);
        if (list.length > 0) setSelected(list[0].code);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar laboratorios'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const load = () => {
      api.getLabDashboard(selected)
        .then(d => { if (!cancelled) setDash(d); })
        .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar dashboard'); });
    };
    load();
    const id = setInterval(load, 15000); // tiempo real
    return () => { cancelled = true; clearInterval(id); };
  }, [selected]);

  const statusCls: Record<string, string> = {
    online: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    idle: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    offline: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Dashboard del Laboratorio</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Estado en tiempo real del laboratorio y su kiosco.</p>
        </div>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer">
          {labs.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
          <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
          <p className="text-sm">Cargando dashboard...</p>
        </div>
      ) : !dash ? null : (
        <>
          {/* Clase en curso */}
          <div className={`rounded-2xl border p-5 shadow-sm ${dash.currentClass ? 'bg-green-50/70 dark:bg-green-950/20 border-green-200 dark:border-green-800/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-label font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold">Clase en curso</p>
                {dash.currentClass ? (
                  <>
                    <p className="text-lg font-black text-zinc-900 dark:text-white mt-1">{dash.currentClass.subject}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Docente: {dash.currentClass.teacherName ?? '—'} · {dash.currentClass.startTime} – {dash.currentClass.endTime}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 mt-1">Sin clase en curso ahora</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${statusCls[dash.kioskStatus]}`}>
                  Kiosco {dash.kioskStatus === 'online' ? 'en línea' : dash.kioskStatus === 'idle' ? 'inactivo' : 'sin conexión'}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-label font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {dash.lastKioskId ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Esperados', value: dash.expectedStudents, icon: UsersIcon, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
              { label: 'Presentes', value: dash.presentStudents, icon: CheckCircle, color: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400' },
              { label: 'Ausentes', value: dash.absentStudents, icon: XCircle, color: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
              { label: 'Ingresos hoy', value: dash.grantedToday, icon: SignIn, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
              { label: 'Rechazos hoy', value: dash.deniedToday, icon: X, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
              { label: 'Incidentes abiertos', value: dash.openIncidents, icon: WarningOctagon, color: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400' },
              { label: 'Latencia media', value: dash.avgRecognitionMs ? `${Math.round(dash.avgRecognitionMs)} ms` : '—', icon: Timer, color: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400' },
              { label: 'Última sinc.', value: dash.lastSync ? new Date(dash.lastSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—', icon: Clock, color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">{label}</span>
                  <p className="text-2xl font-black tracking-tight mt-1 text-zinc-900 dark:text-white">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" weight="regular" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
