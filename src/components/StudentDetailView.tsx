import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle, XCircle, SignIn, Clock, CalendarBlank,
  IdentificationBadge, Flask, User, Fingerprint,
  CaretLeft, CaretRight, Database, WarningCircle,
  GraduationCap, Prohibit
} from '@phosphor-icons/react';
import type { Student, AccessLog } from '../types.ts';
import ConfirmDialog from './ConfirmDialog.tsx';
import EmptyState from './EmptyState.tsx';

interface StudentDetailViewProps {
  student: Student;
  logs: AccessLog[];
  onToggleStatus: (id: string) => void;
  onBack: () => void;
}

const ITEMS_PER_PAGE = 8;

function getPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const pages: (number | 'ellipsis')[] = [0];
  if (current > 3) pages.push('ellipsis');
  const windowStart = Math.max(1, current - 2);
  const windowEnd = Math.min(total - 2, current + 2);
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
  if (current < total - 4) pages.push('ellipsis');
  pages.push(total - 1);
  return pages;
}

function getMatchColor(pct: number) {
  if (pct >= 90) return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-950/40' };
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/40' };
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/40' };
}

function StatusIndicator({ status }: { status: Student['status'] }) {
  const isActive = status === 'allowed';
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
        aria-label={isActive ? 'Estado: Activo' : 'Estado: Suspendido'}
      />
      <div>
        <p className={`text-sm font-bold ${isActive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {isActive ? 'Activo' : 'Suspendido'}
        </p>
        <p className="text-caption text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
          {isActive ? 'Puede acceder al laboratorio' : 'Acceso bloqueado'}
        </p>
      </div>
    </div>
  );
}

function MatchBar({ percentage }: { percentage: number }) {
  const color = getMatchColor(percentage);
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-caption font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Match Biométrico</span>
        <span className={`text-xl font-black tracking-tight ${color.text}`}>{percentage}%</span>
      </div>
      <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color.bar}`}
        />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, subtitle }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div
      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200"
      role="region"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700/50 transition-colors`}>
          <Icon className={`w-4 h-4 ${color}`} weight="regular" />
        </div>
        <span className="text-label font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
      {subtitle && (
        <p className="text-label text-zinc-400 dark:text-zinc-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function AccessLogRow({ log }: { log: AccessLog }) {
  const isPermitido = log.result === 'Permitido';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors duration-150 group"
      role="row"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPermitido ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
        <div className="flex items-center gap-2.5 text-zinc-400 dark:text-zinc-500 min-w-0">
          <CalendarBlank className="w-3.5 h-3.5 flex-shrink-0" weight="regular" />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{log.date}</span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" weight="regular" />
          <span className="text-caption font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{log.time}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className="text-label font-mono font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-500 dark:text-zinc-400"
          aria-label={`Similitud: ${log.similarity}%`}
        >
          {log.similarity}%
        </span>
        <span
          className={`px-2.5 py-1 rounded-xl text-label font-bold ${
            isPermitido
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
          }`}
        >
          {log.result}
        </span>
      </div>
    </motion.div>
  );
}

export default function StudentDetailView({ student, logs, onToggleStatus, onBack }: StudentDetailViewProps) {
  const studentLogs = useMemo(() => logs.filter(l => l.studentId === student.id), [logs, student.id]);
  const total = studentLogs.length;
  const permitidos = studentLogs.filter(l => l.result === 'Permitido').length;
  const denegados = studentLogs.filter(l => l.result === 'Denegado').length;

  const lastAccess = studentLogs.length > 0 ? studentLogs[0] : null;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Permitido' | 'Denegado'>('all');
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filteredLogs = useMemo(() => {
    let result = studentLogs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.date.toLowerCase().includes(q) ||
        l.time.toLowerCase().includes(q) ||
        l.result.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(l => l.result === statusFilter);
    }
    return result;
  }, [studentLogs, search, statusFilter]);

  useEffect(() => { setPage(0); }, [filteredLogs.length]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* ── Breadcrumb ── */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-caption font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors focus-visible:outline-2 focus-visible:outline-accent-500 rounded-md px-1 py-0.5 -ml-1 cursor-pointer"
        aria-label="Volver al listado de alumnos"
      >
        <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
        Volver al listado
      </button>

      {/* ══════════════════════════════════════════
          PROFILE HEADER — 2 columnas en desktop
          ══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 pb-5 pt-5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 ring-[3px] ring-white dark:ring-zinc-900 shadow-lg flex-shrink-0">
              <img
                src={student.photoUrl}
                alt={`Foto de ${student.name}`}
                className="w-full h-full object-cover"
                onError={e => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
              />
            </div>

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <h1 className="text-stat md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
                {student.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 flex-shrink-0" weight="regular" />
                {student.career}
              </p>

              {/* Chips — altura uniforme, mismo gap */}
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-caption font-semibold text-zinc-600 dark:text-zinc-300">
                  <Flask className="w-3.5 h-3.5 text-accent-500" weight="regular" />
                  {student.lab}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-caption font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                  <IdentificationBadge className="w-3.5 h-3.5 text-accent-500" weight="regular" />
                  {student.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-bold ${
                    student.status === 'allowed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                  }`}
                >
                  {student.status === 'allowed'
                    ? <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                    : <XCircle className="w-3.5 h-3.5" weight="fill" />
                  }
                  {student.status === 'allowed' ? 'Habilitado' : 'Suspendido'}
                </span>
              </div>
            </div>

            {/* Acción */}
            <div className="flex-shrink-0 self-stretch md:self-auto flex md:flex-col items-start md:items-end justify-between md:justify-center gap-3">
              <StatusIndicator status={student.status} />
              <button
                onClick={() => setConfirmOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-accent-500 cursor-pointer ${
                  student.status === 'allowed'
                    ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800/40'
                    : 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 border border-green-200 dark:border-green-800/40'
                }`}
                aria-label={student.status === 'allowed' ? 'Suspender alumno' : 'Reintegrar alumno'}
              >
                {student.status === 'allowed'
                  ? <Prohibit className="w-4 h-4" weight="regular" />
                  : <CheckCircle className="w-4 h-4" weight="regular" />
                }
                {student.status === 'allowed' ? 'Suspender' : 'Reintegrar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MATCH BIOMÉTRICO
          ══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <MatchBar percentage={student.matchPercentage} />
      </div>

      {/* ══════════════════════════════════════════
          KPIs — 4 tarjetas en grid
          ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={SignIn}
          value={total}
          label="Total accesos"
          color="text-zinc-700 dark:text-zinc-200"
          subtitle="Histórico completo"
        />
        <StatCard
          icon={CheckCircle}
          value={permitidos}
          label="Permitidos"
          color="text-green-600 dark:text-green-400"
          subtitle={total > 0 ? `${Math.round((permitidos / total) * 100)}% de éxito` : undefined}
        />
        <StatCard
          icon={XCircle}
          value={denegados}
          label="Denegados"
          color="text-red-600 dark:text-red-400"
          subtitle={total > 0 ? `${Math.round((denegados / total) * 100)}% del total` : undefined}
        />
        <StatCard
          icon={Clock}
          value={lastAccess ? lastAccess.date : '—'}
          label="Último acceso"
          color="text-zinc-600 dark:text-zinc-300"
          subtitle={lastAccess ? `${lastAccess.time}` : 'Sin registros'}
        />
      </div>

      {/* ══════════════════════════════════════════
          HISTORIAL DE ACCESOS
          ══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Historial de accesos</h3>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-0.5">
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''} biométrico{filteredLogs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Body */}
        {studentLogs.length === 0 ? (
          <EmptyState icon={Database} title="No existen accesos registrados" description="Los registros aparecerán cuando el alumno utilice el sistema de reconocimiento facial." />
        ) : filteredLogs.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center px-4">
            <WarningCircle className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-3" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Sin resultados</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Ajusta los filtros para ver más registros.</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setPage(0); }}
              className="mt-3 text-caption font-semibold text-accent-600 dark:text-accent-400 hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800" role="table" aria-label="Historial de accesos">
              {paginatedLogs.map(log => (
                <AccessLogRow key={log.id} log={log} />
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <nav aria-label="Paginación" className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-label font-mono text-zinc-400 dark:text-zinc-500">
                  Pág. {page + 1} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400"
                    aria-label="Página anterior"
                  >
                    <CaretLeft className="w-3.5 h-3.5" weight="bold" />
                  </button>
                  {getPageWindow(page, totalPages).map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${idx}`} className="w-7 h-7 flex items-center justify-center text-label text-zinc-400 dark:text-zinc-500 select-none">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-xl text-label font-bold transition-all cursor-pointer ${
                          page === p
                            ? 'bg-accent-600 text-white'
                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        aria-label={`Ir a página ${p + 1}`}
                        aria-current={page === p ? 'page' : undefined}
                      >
                        {p + 1}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400"
                    aria-label="Página siguiente"
                  >
                    <CaretRight className="w-3.5 h-3.5" weight="bold" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={student.status === 'allowed' ? 'Suspender alumno' : 'Reintegrar alumno'}
        message={student.status === 'allowed'
          ? `¿Estás seguro de suspender a ${student.name}? No podrá acceder al laboratorio hasta que sea reintegrado.`
          : `¿Estás seguro de reintegrar a ${student.name}? Podrá volver a acceder al laboratorio.`
        }
        confirmLabel={student.status === 'allowed' ? 'Suspender' : 'Reintegrar'}
        variant={student.status === 'allowed' ? 'danger' : 'default'}
        onConfirm={() => { onToggleStatus(student.id); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.div>
  );
}

