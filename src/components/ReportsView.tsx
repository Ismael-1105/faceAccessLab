import React, { useState, useMemo } from 'react';
import { FileCsv, FileText, ChartBar, TrendUp, Users, Clock } from '@phosphor-icons/react';
import type { AccessLog } from '../types.ts';
import { DAILY_STATS } from '../data.ts';
import { api } from '../lib/api.ts';

interface ReportsViewProps {
  logs: AccessLog[];
}

const PEAK_HOURS = [
  { hour: '07:00 - 08:00', count: 18 },
  { hour: '08:00 - 09:00', count: 42 },
  { hour: '09:00 - 10:00', count: 35 },
  { hour: '10:00 - 11:00', count: 28 },
  { hour: '11:00 - 12:00', count: 31 },
  { hour: '12:00 - 13:00', count: 45 },
  { hour: '13:00 - 14:00', count: 38 },
  { hour: '14:00 - 15:00', count: 22 },
];

const TOP_STUDENTS = [
  { name: 'Alejandro Morales', accesses: 47, avg: 98.2 },
  { name: 'Sofia Villarreal', accesses: 41, avg: 95.6 },
  { name: 'Ismael González', accesses: 38, avg: 99.1 },
  { name: 'Julian Rivas', accesses: 32, avg: 92.8 },
  { name: 'Valentina López', accesses: 29, avg: 94.3 },
];

export default function ReportsView({ logs }: ReportsViewProps) {
  const [period, setPeriod] = useState('week');

  const totalAccesses = logs.length;
  const permitidos = logs.filter(l => l.result === 'Permitido').length;
  const denegados = logs.filter(l => l.result === 'Denegado').length;
  const avgSimilarity = logs.length > 0
    ? (logs.reduce((sum, l) => sum + l.similarity, 0) / logs.length).toFixed(1)
    : '0';

  // Tendencias: accesos de esta semana vs la anterior (por permitidos).
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);

    const inRange = (log: AccessLog, from: Date, to: Date) => {
      const d = new Date(log.date);
      return d >= from && d < to;
    };

    const thisWeek = logs.filter(l => l.result === 'Permitido' && inRange(l, startOfWeek, now)).length;
    const prevWeek = logs.filter(l => l.result === 'Permitido' && inRange(l, startOfPrevWeek, startOfWeek)).length;

    const pct = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : (thisWeek > 0 ? 100 : 0);
    return { thisWeek, prevWeek, pct, trend: thisWeek - prevWeek };
  }, [logs]);

  const computedTopStudents = useMemo(() => {
    const map = new Map<string, { accesses: number; similarities: number[] }>();
    logs.forEach(l => {
      if (!map.has(l.studentName)) {
        map.set(l.studentName, { accesses: 0, similarities: [] });
      }
      const entry = map.get(l.studentName)!;
      entry.accesses += 1;
      entry.similarities.push(l.similarity);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        accesses: data.accesses,
        avg: parseFloat((data.similarities.reduce((a, b) => a + b, 0) / data.similarities.length).toFixed(1)),
      }))
      .sort((a, b) => b.accesses - a.accesses)
      .slice(0, 5);
  }, [logs]);

  const computedPeakHours = useMemo(() => {
    const hourBuckets: Record<string, number> = {};
    logs.forEach(l => {
      const hour = parseInt(l.time.split(':')[0], 10);
      const rangeStart = `${String(hour).padStart(2, '0')}:00`;
      const rangeEnd = `${String(hour).padStart(2, '0')}:59`;
      const label = `${rangeStart} - ${rangeEnd}`;
      hourBuckets[label] = (hourBuckets[label] || 0) + 1;
    });
    return Object.entries(hourBuckets)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [logs]);

  const topStudents = computedTopStudents.length > 0 ? computedTopStudents : TOP_STUDENTS;
  const peakHours = computedPeakHours.length > 0 ? computedPeakHours : PEAK_HOURS;
  const maxDay = DAILY_STATS.chartData.reduce((max, d) => d.count > max.count ? d : max, DAILY_STATS.chartData[0]);

  const handleExportCSV = () => {
    const header = 'Tipo,Valor\n';
    const rows = [
      `Total Accesos,${totalAccesses}`,
      `Permitidos,${permitidos}`,
      `Denegados,${denegados}`,
      `Similitud Promedio,${avgSimilarity}%`,
      `Pico Semanal,${Math.max(...DAILY_STATS.chartData.map(d => d.count))}`,
      '', '',
      'Alumno,Accesos,Similitud Prom. (%)',
      ...TOP_STUDENTS.map(s => `"${s.name}",${s.accesses},${s.avg}`),
    ];
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FaceAccess_Reporte_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [exportError, setExportError] = useState('');

  const handleExportReport = async () => {
    setExportError('');
    try {
      await api.downloadReport();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'No se pudo generar el reporte');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Reportes y Estadísticas</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Métricas de acceso, tendencias y exportación de datos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportReport}
            className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
            <FileText className="w-4 h-4" weight="regular" />
            Exportar reporte
          </button>
          <button onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
            <FileCsv className="w-4 h-4" weight="regular" />
            Exportar CSV
          </button>
        </div>
      </div>

      {exportError && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{exportError}</p>
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-2">
        {['day', 'week', 'month'].map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === p
                ? 'bg-accent-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Accesos', value: totalAccesses, icon: ChartBar, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
          { label: 'Permitidos', value: permitidos, icon: TrendUp, color: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400' },
          { label: 'Denegados', value: denegados, icon: Users, color: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' },
          { label: 'Similitud Promedio', value: `${avgSimilarity}%`, icon: Clock, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Accesos por Día</h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Lecturas biométricas procesadas.</p>
          </div>
          <div className="flex justify-between items-end h-48 px-2 gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
            {DAILY_STATS.chartData.map((bar, i) => {
              const max = Math.max(...DAILY_STATS.chartData.map(d => d.count));
              const pct = (bar.count / max) * 100;
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full flex justify-center">
                    <div className="absolute -top-6 scale-0 group-hover:scale-100 group-focus-within:scale-100 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-micro font-mono font-bold px-1.5 py-0.5 rounded transition-transform whitespace-nowrap">
                      {bar.count}
                    </div>
                    <div
                      tabIndex={0}
                      role="img"
                      aria-label={`${bar.day}: ${bar.count} accesos`}
                      style={{ height: `${pct}%` }}
                      className="w-3/5 rounded-t-lg bg-accent-500 hover:bg-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 outline-none transition-all cursor-pointer"
                    />
                  </div>
                  <span className="text-micro font-semibold text-zinc-400 dark:text-zinc-500 mt-2">{bar.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak hours */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Horas Pico</h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Concentración de accesos por hora.</p>
          </div>
          <div className="space-y-4">
          {[
              { label: 'Mañana (07:00–11:00)', data: peakHours.filter(h => parseInt(h.hour) < 12) },
              { label: 'Mediodía (12:00–15:00)', data: peakHours.filter(h => parseInt(h.hour) >= 12) },
            ].map(group => {
              const max = Math.max(...group.data.map(h => h.count));
              return (
                <div key={group.label}>
                  <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.data.map(({ hour, count }) => {
                      const pct = (count / max) * 100;
                      return (
                        <div key={hour} className="flex items-center gap-3">
                          <span className="text-label font-mono text-zinc-500 dark:text-zinc-400 w-20 flex-shrink-0">{hour}</span>
                          <div className="flex-1 h-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div style={{ width: `${pct}%` }}
                              className="h-full rounded-xl bg-gradient-to-r from-accent-500 to-accent-600"
                            />
                          </div>
                          <span className="text-label font-mono font-bold text-zinc-500 dark:text-zinc-400 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top students */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Top 5 — Alumnos con más accesos</h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Esta semana.</p>
          </div>
        </div>
        <div className="space-y-3">
          {topStudents.map((s, i) => (
            <div key={s.name} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-label font-bold ${
                  i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  i === 1 ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300' :
                  i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                }`}>{i + 1}</span>
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-label text-zinc-400 dark:text-zinc-500">{s.accesses} accesos</span>
                <span className="text-label font-mono font-bold bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-xl">{s.avg}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Resumen del Período</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {[
            { label: 'Total Accesos', value: totalAccesses },
            { label: 'Promedio Diario', value: (totalAccesses / 7).toFixed(1) },
            { label: 'Pico Semanal', value: `${maxDay.count} (${maxDay.day})` },
            { label: 'Tasa de Autorización', value: totalAccesses > 0 ? `${((permitidos / totalAccesses) * 100).toFixed(1)}%` : '0%' },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">{label}</p>
              <p className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tendencia semanal */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Tendencia semanal</h4>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Accesos permitidos comparados con la semana anterior.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">Esta semana</p>
            <p className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">{weeklyTrend.thisWeek}</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">Semana anterior</p>
            <p className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">{weeklyTrend.prevWeek}</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">Variación</p>
            <p className={`text-sm font-black mt-0.5 ${weeklyTrend.trend > 0 ? 'text-green-600 dark:text-green-400' : weeklyTrend.trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
              {weeklyTrend.trend > 0 ? '+' : ''}{weeklyTrend.pct}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

