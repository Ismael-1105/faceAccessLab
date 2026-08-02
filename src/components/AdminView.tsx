/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Heartbeat, ShieldWarning, SignIn, MagnifyingGlass, FileCsv,
  Plus, CheckCircle, XCircle, Trash, SlidersHorizontal, SignOut,
  ChartBar, GearSix, CaretLeft, CaretRight, UserCheck, Flask, Scroll
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext.tsx';
import { api, getToken } from '../lib/api.ts';
import { getPhotoSrc } from '../lib/photoUrl.ts';
import EnrollmentView from './EnrollmentView.tsx';
import StudentDetailView from './StudentDetailView.tsx';
import AlertsCenter from './AlertsCenter.tsx';
import ReportsView from './ReportsView.tsx';
import EmptyState from './EmptyState.tsx';
import UsersView from './UsersView.tsx';
import LabsView from './LabsView.tsx';
import AuditView from './AuditView.tsx';
import HealthCard from './HealthCard.tsx';
import MfaSetup from './MfaSetup.tsx';

export default function AdminView({ mode: navigationMode }: { mode?: 'demo' | 'arquitectura' } = {}) {
  const {
    students, logs, stats,
    handleToggleStudent, handleAddStudent, handleClearLogs,
    alerts, setAlerts,
    user, handleLogout, connectionStatus,
  } = useApp();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'logs' | 'alerts' | 'users' | 'labs' | 'audit' | 'reports' | 'config'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'All' | 'Permitido' | 'Denegado'>('All');
  const [logPage, setLogPage] = useState(0);
  const LOGS_PER_PAGE = 20;
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [clearState, setClearState] = useState<'idle' | 'confirming' | 'done'>('idle');
  const [typedConfirm, setTypedConfirm] = useState('');

  const handleAcknowledgeAlert = async (id: string) => {
    const prev = alerts;
    setAlerts(prevState => prevState.map(a => a.id === id && a.status === 'active' ? { ...a, status: 'acknowledged' as const } : a));
    try {
      await api.updateAlert(id, 'acknowledged');
    } catch (e) {
      setAlerts(prev);
      console.error('[Admin] Error al reconocer alerta:', e);
    }
  };

  const handleResolveAlert = async (id: string) => {
    const prev = alerts;
    setAlerts(prevState => prevState.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
    try {
      await api.updateAlert(id, 'resolved');
    } catch (e) {
      setAlerts(prev);
      console.error('[Admin] Error al resolver alerta:', e);
    }
  };

  const handleExportCSV = () => {
    const header = 'ID_Log,Alumno,Fecha,Hora,Resultado,Similitud\n';
    const body = logs.map(l => `${l.id},"${l.studentName}",${l.date},${l.time},${l.result},${l.similarity}%`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FaceAccess_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = logFilter === 'All' || log.result === logFilter;
    return matchesSearch && matchesFilter;
  });

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice(logPage * LOGS_PER_PAGE, (logPage + 1) * LOGS_PER_PAGE);

  const weeklyBars = useMemo(() => {
    const dayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const counts = new Array(7).fill(0);
    const dayIndex = new Map([
      ['Mon', 0], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 4], ['Sat', 5], ['Sun', 6],
    ]);
    logs.forEach(l => {
      const day = new Date(l.date).toString().slice(0, 3);
      const idx = dayIndex.get(day);
      if (idx !== undefined) counts[idx] += 1;
    });
    const max = Math.max(1, ...counts);
    return dayLabels.map((day, i) => ({ day, count: counts[i], pct: `${Math.round((counts[i] / max) * 100)}%` }));
  }, [logs]);

  const authorizedRate = useMemo(() => {
    if (logs.length === 0) return 0;
    const granted = logs.filter(l => l.result === 'Permitido').length;
    return parseFloat(((granted / logs.length) * 100).toFixed(1));
  }, [logs]);

  const todayKpis = useMemo(() => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const todayLogs = logs.filter(l => l.date === today);
    const granted = todayLogs.filter(l => l.result === 'Permitido').length;
    const denied = todayLogs.length - granted;
    const successRate = todayLogs.length > 0 ? Math.round((granted / todayLogs.length) * 100) : 0;
    const labUsage = new Map<string, number>();
    todayLogs.forEach(l => {
      if (l.kioskId) labUsage.set(l.kioskId, (labUsage.get(l.kioskId) || 0) + 1);
    });
    const topKiosk = [...labUsage.entries()].sort((a, b) => b[1] - a[1])[0];
    return { accessesToday: todayLogs.length, granted, denied, successRate, topKiosk: topKiosk?.[0] || null };
  }, [logs]);

  useEffect(() => {
    setLogPage(0);
  }, [searchQuery, logFilter]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.career.toLowerCase().includes(studentSearch.toLowerCase())
  );

  type AdminTab = 'overview' | 'students' | 'logs' | 'alerts' | 'users' | 'labs' | 'audit' | 'reports' | 'config';
  const isAdmin = user?.role === 'admin';
  const PRIMARY_ITEMS: { tab: AdminTab; icon: React.ElementType; label: string }[] = [
    { tab: 'overview', icon: Heartbeat, label: 'Vista General' },
    { tab: 'students', icon: Users, label: `Alumnos (${students.length})` },
    { tab: 'logs', icon: SlidersHorizontal, label: `Historial (${logs.length})` },
    { tab: 'alerts', icon: ShieldWarning, label: `Alertas (${alerts.filter(a => a.status === 'active').length})` },
    ...(isAdmin ? [
      { tab: 'users' as const, icon: UserCheck, label: 'Docentes' },
      { tab: 'labs' as const, icon: Flask, label: 'Laboratorios' },
      { tab: 'audit' as const, icon: Scroll, label: 'Auditoría' },
    ] : []),
  ];

  return (
    <div className="pt-16 min-h-screen bg-surface dark:bg-zinc-950 flex flex-col md:flex-row">

      {/* Sidebar — horizontal en móvil, columna fija en desktop */}
      <aside className="w-full md:w-60 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col md:min-h-[calc(100vh-64px)] px-4 py-3 md:px-5 md:py-5">
        <div className="mb-3 md:mb-4 flex items-center justify-between md:block">
          <div>
            <p className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 uppercase font-bold">Administrador</p>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mt-1">Consola de Control</h3>
          </div>
          <button
            onClick={() => { handleLogout(); router.push('/'); }}
            className="md:hidden p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
            aria-label="Cerrar sesión"
          >
            <SignOut className="w-5 h-5" weight="regular" />
          </button>
        </div>

        <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
          {PRIMARY_ITEMS.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
              className={`w-full shrink-0 md:shrink py-2.5 px-3 text-xs text-left rounded-lg font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === tab
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" weight={activeTab === tab ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}

          {/* Calibración: en desktop va separada con divider — solo admin */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('config')}
              className={`w-full shrink-0 md:shrink py-2 px-3 text-xs text-left rounded-lg font-semibold transition-all flex items-center gap-2.5 cursor-pointer md:mt-4 md:pt-4 md:border-t md:border-zinc-100 md:dark:border-zinc-800 ${
                activeTab === 'config'
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <GearSix className="w-4 h-4 flex-shrink-0" weight={activeTab === 'config' ? 'fill' : 'regular'} />
              Calibración
            </button>
          )}
        </nav>

        {/* Status — solo en desktop */}
        <div className="hidden md:block pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          {user && (
            <div className="flex items-center gap-2 px-1" title={user.name}>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" aria-hidden="true" />
              <span className="text-label text-zinc-400 dark:text-zinc-500 font-medium truncate">{user.name || user.email}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => { handleLogout(); router.push('/'); }}
          className="hidden md:flex w-full mt-4 py-2.5 px-3 text-xs text-left rounded-lg font-semibold transition-all items-center gap-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
        >
          <SignOut className="w-4 h-4 flex-shrink-0" weight="regular" />
          Cerrar sesión
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-5 md:p-8 overflow-x-hidden">
        <h1 className="sr-only">Panel de Administración</h1>

        {connectionStatus === 'offline' && (
          <div role="status" className="mb-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <ShieldWarning className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Sin conexión con el backend</p>
              <p className="text-caption text-amber-700 dark:text-amber-400 mt-0.5">Mostrando datos de demostración. Verifica MongoDB y los servicios AWS.</p>
            </div>
          </div>
        )}

        {/* ========== OVERVIEW ========== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
              { label: 'Alumnos', value: stats.registered, icon: Users, accent: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
              { label: 'Accesos Hoy', value: stats.accessesToday, icon: SignIn, accent: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400' },
              { label: 'Bloqueos', value: stats.deniedToday, icon: XCircle, accent: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
              { label: 'Alertas', value: alerts.filter(a => a.status === 'active').length, icon: ShieldWarning, accent: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400', alert: true },
              ].map(({ label, value, icon: Icon, accent, alert }, i) => (
                <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">{label}</span>
                    <p className={`${i === 0 ? 'text-3xl' : 'text-2xl'} font-black tracking-tight mt-1 ${alert && value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
                      {value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
                    <Icon className="w-5 h-5" weight="regular" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Escaneos hoy</span>
                <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{todayKpis.accessesToday}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Permitidos</span>
                <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{todayKpis.granted}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Denegados</span>
                <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{todayKpis.denied}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">% Éxito</span>
                <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{todayKpis.successRate}%</p>
                <p className="text-label text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {todayKpis.topKiosk ? `Kiosco más usado: ${todayKpis.topKiosk}` : 'Sin actividad'}
                </p>
              </div>
            </div>

            <HealthCard />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Bar chart */}
              <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Accesos por Día</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Lecturas biométricas procesadas esta semana.</p>
                </div>
                <div className="flex justify-between items-end h-52 px-4 gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-1.5 pt-4">
                  {weeklyBars.map((bar) => (
                    <div key={bar.day} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full flex justify-center">
                        <div className="absolute -top-7 scale-0 group-hover:scale-100 group-focus-within:scale-100 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-micro font-mono font-bold px-1.5 py-0.5 rounded-lg transition-transform">
                          {bar.count}
                        </div>
                        <div
                          tabIndex={0}
                          role="img"
                          aria-label={`${bar.day}: ${bar.count} accesos`}
                          style={{ height: bar.pct }}
                          className="w-4/5 rounded-t-lg bg-accent-500 hover:bg-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <span className="text-label font-semibold text-zinc-400 dark:text-zinc-500 mt-2">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Donut */}
              <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Tasa de Autorización</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Métrica acumulativa.</p>
                </div>
                <div className="my-6 relative flex items-center justify-center">
                  <svg className="w-36 h-36" viewBox="0 0 36 36">
                    <path className="text-zinc-100 dark:text-zinc-800" strokeWidth="3.5" stroke="currentColor" fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-green-500"
                      strokeDasharray={`${authorizedRate}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{authorizedRate}%</p>
                    <p className="text-micro font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Aceptado</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-label border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    <span className="text-zinc-500 dark:text-zinc-400">{authorizedRate}% Permitidos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                    <span className="text-zinc-500 dark:text-zinc-400">{(100 - authorizedRate).toFixed(1)}% Denegados</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent logs */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Ultimas Lecturas</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Logs en tiempo real.</p>
                </div>
                <button onClick={() => setActiveTab('logs')} className="text-xs text-accent-600 dark:text-accent-400 font-semibold hover:underline cursor-pointer">
                  Ver todos
                </button>
              </div>
              <div className="space-y-2.5">
                {logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-3 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-600 text-white text-label font-bold flex items-center justify-center">
                        {log.avatarInitials}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white truncate max-w-[180px]" title={log.studentName}>{log.studentName}</p>
                        <p className="text-label text-zinc-400 dark:text-zinc-500">{log.time} &middot; {log.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-zinc-400 dark:text-zinc-500 text-label">{log.similarity}%</span>
                      <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${
                        log.result === 'Permitido' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>{log.result}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== STUDENTS ========== */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {showEnrollment ? (
              <div className="pt-16 min-h-screen bg-surface dark:bg-zinc-950 px-4 md:px-8 pb-8 flex justify-center">
                <EnrollmentView
                  onComplete={(student) => { handleAddStudent(student); setShowEnrollment(false); }}
                  onCancel={() => setShowEnrollment(false)}
                />
              </div>
            ) : selectedStudentId ? (
              (() => {
                const student = students.find(s => s.id === selectedStudentId);
                if (!student) return null;

  return (
                  <StudentDetailView
                    student={student}
                    logs={logs}
                    onToggleStatus={handleToggleStudent}
                    onBack={() => setSelectedStudentId(null)}
                    onDelete={async (id) => {
                      try {
                        await fetch('/api/students', {
                          method: 'DELETE',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getToken()}`,
                          },
                          body: JSON.stringify({ id }),
                        });
                        setSelectedStudentId(null);
                      } catch (e) { console.error('[Admin] Error al eliminar estudiante:', e); }
                    }}
                  />
                );
              })()
            ) : (
              <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Registro de Alumnos</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Gestione identidades biométricas del LAB-02.</p>
              </div>
              <button
                onClick={() => setShowEnrollment(true)}
                className="bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 py-2.5 text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" weight="bold" />
                Matricular Alumno
              </button>
            </div>

            <div className="relative w-full sm:max-w-xs mt-3">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all duration-200"
              />
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table aria-label="Registro de alumnos" className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                      <th className="p-4">Estudiante</th>
                      <th className="p-4">Especialidad</th>
                      <th className="p-4">Lab</th>
                      <th className="p-4 text-center">Match</th>
                      <th className="p-4 text-center">Permiso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} tabIndex={0} role="button" className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => setSelectedStudentId(student.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStudentId(student.id); } }} aria-label={`Ver detalle de ${student.name}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center relative">
                              <img className="w-full h-full object-cover" alt={student.name} src={getPhotoSrc(student.photoUrl)} onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }} />
                              <span className="absolute text-xs font-bold text-zinc-400">{student.avatarInitials}</span>
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white text-sm truncate max-w-[200px]" title={student.name}>{student.name}</p>
                              <span className="text-label text-zinc-400 dark:text-zinc-500 font-mono">{student.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-300 truncate max-w-[180px]" title={student.career}>{student.career}</td>
                        <td className="p-4 font-semibold text-zinc-600 dark:text-zinc-300">{student.lab}</td>
                        <td className="p-4 text-center font-mono text-zinc-400 dark:text-zinc-500 font-bold">{student.matchPercentage}%</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${
                            student.status === 'allowed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }`}>
                            {student.status === 'allowed' ? 'Habilitado' : 'Suspendido'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
            </>
          )}
        </div>
        )}

        {/* ========== LOGS ========== */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Historial de Accesos</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Concordancias, marcas temporales e incidencias.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('reports')}
                  className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
                  <ChartBar className="w-4 h-4" weight="regular" />
                  Reportes
                </button>
                <button onClick={handleExportCSV}
                  className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
                  <FileCsv className="w-4 h-4" weight="regular" />
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm text-xs">
              <div className="relative w-full sm:max-w-xs">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                <input type="text" placeholder="Buscar estudiante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all" />
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="text-zinc-400 dark:text-zinc-500 font-semibold flex-shrink-0">Filtrar:</span>
                <select value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  className="text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all">
                  <option value="All">Todos</option>
                  <option value="Permitido">Solo Permitidos</option>
                  <option value="Denegado">Solo Denegados</option>
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {filteredLogs.length > 0 ? (
                  <table aria-label="Historial de accesos" className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                        <th className="p-4">ID</th>
                        <th className="p-4">Alumno</th>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Hora</th>
                        <th className="p-4 text-center">Fidelidad</th>
                        <th className="p-4 text-center">Cerradura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4 font-mono text-zinc-400 dark:text-zinc-500 font-semibold">{log.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-accent-600 text-white text-micro font-bold flex items-center justify-center">{log.avatarInitials}</span>
                              <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]" title={log.studentName}>{log.studentName}</span>
                            </div>
                          </td>
                          <td className="p-4 text-zinc-500 dark:text-zinc-400">{log.date}</td>
                          <td className="p-4 font-mono text-zinc-600 dark:text-zinc-300">{log.time}</td>
                          <td className="p-4 text-center">
                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-label font-bold text-zinc-500 dark:text-zinc-400">
                              {log.similarity}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${
                              log.result === 'Permitido' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                            }`}>
                              {log.result === 'Permitido' ? 'Desbloqueada' : 'Bloqueada'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">No se encontraron accesos con los filtros provistos.</div>
                )}
              </div>
              {filteredLogs.length > 0 && (
                <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-label font-mono text-zinc-400 dark:text-zinc-500">
                    Mostrando {logPage * LOGS_PER_PAGE + 1}–{Math.min((logPage + 1) * LOGS_PER_PAGE, filteredLogs.length)} de {filteredLogs.length} registros
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLogPage(p => Math.max(0, p - 1))}
                      disabled={logPage === 0}
                      className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400"
                      aria-label="Página anterior"
                    >
                      <CaretLeft className="w-3.5 h-3.5" weight="bold" />
                    </button>
                    <span className="text-label font-mono text-zinc-500 dark:text-zinc-400">
                      Pág. {logPage + 1} de {totalLogPages}
                    </span>
                    <button
                      onClick={() => setLogPage(p => Math.min(totalLogPages - 1, p + 1))}
                      disabled={logPage >= totalLogPages - 1}
                      className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-zinc-500 dark:text-zinc-400"
                      aria-label="Página siguiente"
                    >
                      <CaretRight className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== ALERTS ========== */}
        {activeTab === 'alerts' && (
          <AlertsCenter
            alerts={alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onResolve={handleResolveAlert}
          />
        )}

        {/* ========== USERS (DOCENTES) ========== */}
        {activeTab === 'users' && isAdmin && (
          <UsersView />
        )}

        {activeTab === 'labs' && isAdmin && (
          <LabsView />
        )}

        {activeTab === 'audit' && isAdmin && (
          <AuditView />
        )}

        {/* ========== REPORTS ========== */}
        {activeTab === 'reports' && (
          <ReportsView logs={logs} />
        )}

        {/* ========== CONFIG — solo admin ========== */}
        {activeTab === 'config' && isAdmin && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Calibración y Umbrales</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Ajuste de sensibilidad, tolerancia y sincronización.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-5">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">Parámetros del Sensor</h4>
                {[
                  { label: 'Umbral de Similitud Mínimo', value: '85.0%', min: '75', max: '99', default: '85', desc: 'Límite matemático en Amazon Rekognition para decretar match.' },
                  { label: 'Tolerancia Micro-Parpadeo', value: 'Alta', min: '1', max: '3', default: '2', desc: 'Sensibilidad al evaluar vivacidad contra fotos estáticas.' },
                  { label: 'Tiempo de Apertura', value: '10 Segundos', min: '3', max: '30', default: '10', desc: 'Lapso que la bobina electromagnética permanece energizada.' },
                ].map(({ label, value, min, max, default: def, desc }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-caption font-semibold text-zinc-700 dark:text-zinc-300">{label}</label>
                      <span className="text-caption font-mono font-bold bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-lg">{value}</span>
                    </div>
                    <input type="range" min={min} max={max} defaultValue={def}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-accent-600" />
                    <span className="text-label text-zinc-400 dark:text-zinc-500 mt-1 block">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">Incidencias de Hardware</h4>
                <div className="space-y-3 font-mono text-label">
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-800 dark:text-red-400 flex justify-between items-center">
                    <span>ALERTA_TERMICA_KIOSK_42 // 41&deg;C</span>
                    <span className="font-bold">ACTIVA</span>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-400 flex justify-between items-center">
                    <span>RETARDO_PING_AWS // LATENCY: 85ms</span>
                    <span className="font-bold">ADVERTENCIA</span>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl text-green-800 dark:text-green-400 flex justify-between items-center">
                    <span>CAMARA_ESTATIC_OK // IMX415_READY</span>
                    <span className="font-bold">SOPORTADO</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">Gestión de Datos</h4>

              {clearState === 'idle' && (
                <>
                  <p className="text-caption text-zinc-500 dark:text-zinc-400">Eliminar todos los registros de acceso del sistema. Esta acción es irreversible.</p>
                  <button
                    onClick={() => setClearState('confirming')}
                    className="px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                  >
                    <Trash className="w-4 h-4" weight="regular" />
                    Limpiar historial de accesos
                  </button>
                </>
              )}

              {clearState === 'confirming' && (
                <div className="space-y-3">
                  <p className="text-caption text-red-600 dark:text-red-400 font-semibold">
                    Esta acción es irreversible. Escribe <span className="font-mono font-bold">LIMPIAR</span> para confirmar.
                  </p>
                  <input
                    type="text"
                    value={typedConfirm}
                    onChange={e => setTypedConfirm(e.target.value)}
                    placeholder="Escribe LIMPIAR"
                    className="w-full p-2.5 rounded-lg border border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setClearState('idle'); setTypedConfirm(''); }}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { handleClearLogs(); setClearState('done'); setTypedConfirm(''); }}
                      disabled={typedConfirm !== 'LIMPIAR'}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Confirmar y limpiar
                    </button>
                  </div>
                </div>
              )}

              {clearState === 'done' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" weight="fill" />
                    <p className="text-caption font-semibold">Historial de accesos limpiado correctamente.</p>
                  </div>
                  <button
                    onClick={() => setClearState('idle')}
                    className="text-caption text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>

            <MfaSetup />
          </div>
        )}

      </main>


    </div>
  );
}

