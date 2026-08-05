'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal, CircleNotch, X, ArrowSquareOut, ShieldWarning,
  WarningOctagon, SignIn, Prohibit, CaretLeft, CaretRight, MagnifyingGlass, Eye,
} from '@phosphor-icons/react';
import type { AccessLog, DenialEvidence, Incident, Student } from '../types.ts';
import { api } from '../lib/api.ts';
import { DENIAL_REASONS } from '../lib/kiosk-feedback.ts';
import HistorialDetailView from './HistorialDetailView.tsx';

export type HistorialEntry =
  | { kind: 'acceso'; item: AccessLog }
  | { kind: 'evidencia'; item: DenialEvidence }
  | { kind: 'incidente'; item: Incident };

const PAGE_SIZE = 15;

const DATE_OPTIONS = [
  { value: 'all', label: 'Todas las fechas' },
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
] as const;
type DateFilter = typeof DATE_OPTIONS[number]['value'];

const DAY_MS = 86_400_000;
const DATE_RANGE_MS: Record<Exclude<DateFilter, 'all' | 'today'>, number> = {
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '90d': 90 * DAY_MS,
};

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Valor de motivo según el tipo de registro (para el filtro). */
function reasonOf(e: HistorialEntry): string {
  if (e.kind === 'incidente') return e.item.type;
  return e.item.reason || '';
}

/** Etiqueta legible para el motivo (códigos de rechazo o tipo de incidente). */
function reasonLabel(value: string): string {
  if (value === 'repeated_denials') return 'Rechazos repetidos';
  if (value === 'kiosk_anomaly') return 'Anomalía de kiosco';
  const denial = DENIAL_REASONS[value as keyof typeof DENIAL_REASONS];
  return denial ? `${denial.code} · ${denial.title}` : value;
}

/** Marca de tiempo en ms de un registro, para filtrar por fecha. */
function entryTimestamp(e: HistorialEntry): number {
  if (e.kind === 'acceso') {
    const d = new Date(`${e.item.date} ${e.item.time}`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return new Date(e.item.createdAt).getTime();
}

interface HistorialViewProps {
  logs: AccessLog[];
  students: Student[];
}

export default function HistorialView({ logs, students }: HistorialViewProps) {
  const [evidence, setEvidence] = useState<DenialEvidence[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'acceso' | 'evidencia' | 'incidente'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'Permitido' | 'Denegado'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [labFilter, setLabFilter] = useState('all');
  const [kioskFilter, setKioskFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<HistorialEntry | null>(null);

  useEffect(() => {
    Promise.all([api.getEvidence().catch(() => []), api.getIncidents().catch(() => [])])
      .then(([ev, inc]) => { setEvidence(ev); setIncidents(inc); })
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar historial'))
      .finally(() => setLoading(false));
  }, []);

  const studentName = useCallback((id?: string) => id ? (students.find(s => s.id === id)?.name || id) : undefined, [students]);

  const entries = useMemo<HistorialEntry[]>(() => {
    const accesos: HistorialEntry[] = logs.map(item => ({ kind: 'acceso', item }));
    const evidencias: HistorialEntry[] = evidence.map(item => ({ kind: 'evidencia', item }));
    const incidencias: HistorialEntry[] = incidents.map(item => ({ kind: 'incidente', item }));
    return [...accesos, ...evidencias, ...incidencias].sort((a, b) => entryTimestamp(b) - entryTimestamp(a));
  }, [logs, evidence, incidents]);

  const labOptions = useMemo(
    () => Array.from(new Set(entries.map(e => e.item.labCode).filter((v): v is string => Boolean(v)))).sort(),
    [entries],
  );
  const kioskOptions = useMemo(
    () => Array.from(new Set(entries.map(e => e.item.kioskId).filter((v): v is string => Boolean(v)))).sort(),
    [entries],
  );
  const reasonOptions = useMemo(
    () => Array.from(new Set(entries.map(reasonOf).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (e.kind === 'acceso' && resultFilter !== 'all' && e.item.result !== resultFilter) return false;
      if (labFilter !== 'all' && (e.item.labCode || '') !== labFilter) return false;
      if (kioskFilter !== 'all' && (e.item.kioskId || '') !== kioskFilter) return false;
      if (reasonFilter !== 'all' && reasonOf(e) !== reasonFilter) return false;
      if (dateFilter !== 'all') {
        const ts = entryTimestamp(e);
        const start = dateFilter === 'today'
          ? new Date().setHours(0, 0, 0, 0)
          : Date.now() - DATE_RANGE_MS[dateFilter];
        if (ts < start) return false;
      }
      if (!q) return true;
      const name = e.kind === 'acceso' ? e.item.studentName : (studentName(e.item.studentId) || '');
      const lab = e.item.labCode || '';
      const kiosk = e.item.kioskId || '';
      const reason = reasonOf(e);
      return [name, lab, kiosk, reason, e.item.id, e.item.studentId || '']
        .some(v => v.toLowerCase().includes(q));
    });
  }, [entries, kindFilter, resultFilter, dateFilter, labFilter, kioskFilter, reasonFilter, query, studentName]);

  const hasActiveFilters = kindFilter !== 'all' || resultFilter !== 'all' || dateFilter !== 'all'
    || labFilter !== 'all' || kioskFilter !== 'all' || reasonFilter !== 'all' || query.trim() !== '';

  const resetFilters = () => {
    setKindFilter('all');
    setResultFilter('all');
    setDateFilter('all');
    setLabFilter('all');
    setKioskFilter('all');
    setReasonFilter('all');
    setQuery('');
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [kindFilter, resultFilter, dateFilter, labFilter, kioskFilter, reasonFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const badge = (e: HistorialEntry) => {
    if (e.kind === 'acceso') {
      return e.item.result === 'Permitido'
        ? { label: 'Permitido', cls: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' }
        : { label: 'Denegado', cls: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' };
    }
    if (e.kind === 'evidencia') return { label: 'Evidencia', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' };
    return e.item.status === 'open'
      ? { label: 'Incidente', cls: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' }
      : { label: 'Incidente cerrado', cls: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' };
  };

  const icon = (e: HistorialEntry) => e.kind === 'acceso'
    ? (e.item.result === 'Permitido' ? <SignIn className="w-4 h-4" weight="fill" /> : <Prohibit className="w-4 h-4" weight="fill" />)
    : e.kind === 'evidencia' ? <WarningOctagon className="w-4 h-4" weight="fill" /> : <ShieldWarning className="w-4 h-4" weight="fill" />;

  const selectCls = 'text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer';

  if (selected) {
    return <HistorialDetailView entry={selected} studentName={studentName} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Historial</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Accesos, evidencias e incidentes unificados. Selecciona un registro para ver el detalle.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm text-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
            <input type="text" placeholder="Buscar estudiante, lab, kiosco, motivo..." value={query} onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all" />
          </div>
          <button onClick={resetFilters} disabled={!hasActiveFilters}
            className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${hasActiveFilters
              ? 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              : 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'}`}>
            Limpiar filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select value={kindFilter}
            onChange={e => { setKindFilter(e.target.value as typeof kindFilter); setResultFilter('all'); }}
            className={selectCls}>
            <option value="all">Todos los tipos</option>
            <option value="acceso">Accesos</option>
            <option value="evidencia">Evidencias</option>
            <option value="incidente">Incidentes</option>
          </select>

          {(kindFilter === 'all' || kindFilter === 'acceso') && (
            <select value={resultFilter} onChange={e => setResultFilter(e.target.value as typeof resultFilter)}
              className={selectCls}>
              <option value="all">Todos los resultados</option>
              <option value="Permitido">Permitidos</option>
              <option value="Denegado">Denegados</option>
            </select>
          )}

          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} className={selectCls}>
            {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select value={labFilter} onChange={e => setLabFilter(e.target.value)} className={selectCls}>
            <option value="all">Todos los laboratorios</option>
            {labOptions.map(lab => <option key={lab} value={lab}>{lab}</option>)}
          </select>

          <select value={kioskFilter} onChange={e => setKioskFilter(e.target.value)} className={selectCls}>
            <option value="all">Todos los kioscos</option>
            {kioskOptions.map(kiosk => <option key={kiosk} value={kiosk}>{kiosk}</option>)}
          </select>

          <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)} className={selectCls}>
            <option value="all">Todos los motivos</option>
            {reasonOptions.map(reason => <option key={reason} value={reason}>{reasonLabel(reason)}</option>)}
          </select>
        </div>
      </div>

      {/* Lista unificada */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
            <p className="text-sm">Cargando historial...</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
            <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Sin registros con los filtros aplicados</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Ajusta los filtros o la búsqueda.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paged.map(e => {
                const b = badge(e);
                const label = e.kind === 'acceso'
                  ? e.item.studentName
                  : e.kind === 'evidencia'
                    ? (studentName(e.item.studentId) || 'Persona no identificada')
                    : (e.item.type === 'repeated_denials' ? 'Rechazos repetidos' : 'Anomalía de kiosco');
                const sub = e.kind === 'acceso'
                  ? `${e.item.date} · ${e.item.time}`
                  : e.kind === 'evidencia'
                    ? `Evidencia · ${formatDate(e.item.createdAt)}`
                    : `Incidente · ${formatDate(e.item.createdAt)}`;
                const meta = e.kind === 'acceso'
                  ? `${e.item.labCode || '—'} · ${e.item.kioskId || '—'}${e.item.similarity ? ` · ${e.item.similarity}%` : ''}`
                  : e.kind === 'evidencia'
                    ? `${e.item.labCode || '—'} · ${e.item.kioskId || '—'} · ${e.item.reason}`
                    : `${e.item.count} rechazos · ${e.item.labCode || '—'}`;
                return (
                  <button key={`${e.kind}-${e.item.id}`} onClick={() => setSelected(e)}
                    className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left cursor-pointer group">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${b.cls}`}>
                      {icon(e)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{label}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-label font-bold ${b.cls}`}>{b.label}</span>
                      </div>
                      <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{meta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-label font-mono text-zinc-400 dark:text-zinc-500">{sub}</p>
                      <span className="inline-flex items-center gap-1 text-caption font-semibold text-accent-600 dark:text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3 h-3" weight="regular" />
                        Ver detalle
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-label font-mono text-zinc-400 dark:text-zinc-500">
                  Pág. {page + 1} de {totalPages} · {filtered.length} registros
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400" aria-label="Anterior">
                    <CaretLeft className="w-3.5 h-3.5" weight="bold" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400" aria-label="Siguiente">
                    <CaretRight className="w-3.5 h-3.5" weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
