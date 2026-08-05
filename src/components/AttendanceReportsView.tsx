'use client';

import React, { useEffect, useState } from 'react';
import {
  ChartBar, CircleNotch, FileCsv, FileText, X, TrendDown, WarningOctagon, Timer,
} from '@phosphor-icons/react';
import type { AttendanceReport } from '../types.ts';
import { api } from '../lib/api.ts';

export default function AttendanceReportsView() {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  const load = () => {
    setLoading(true);
    api.getAttendanceReport()
      .then(setReport)
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar reporte'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const exportTo = async (format: 'excel' | 'pdf') => {
    setExportError('');
    try {
      await api.downloadAttendanceReport(format);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'No se pudo exportar');
    }
  };

  const totalExpected = report?.byClass.reduce((s, r) => s + r.expected, 0) ?? 0;
  const totalPresent = report?.byClass.reduce((s, r) => s + r.present, 0) ?? 0;
  const overallRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Reportes de Asistencia</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Asistencia por clase y estudiante, retrasos, rechazos e incidentes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportTo('excel')}
            className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
            <FileCsv className="w-4 h-4" weight="regular" />
            Exportar Excel
          </button>
          <button onClick={() => exportTo('pdf')}
            className="px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
            <FileText className="w-4 h-4" weight="regular" />
            Exportar PDF
          </button>
        </div>
      </div>

      {(error || exportError) && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error || exportError}</p>
        </div>
      )}

      {loading ? (
        <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
          <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
          <p className="text-sm">Calculando reporte...</p>
        </div>
      ) : !report ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Inscritos', value: totalExpected, icon: ChartBar, color: 'bg-accent-50 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400' },
              { label: 'Presentes', value: totalPresent, icon: ChartBar, color: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400' },
              { label: '% Asistencia', value: `${overallRate}%`, icon: ChartBar, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
              { label: 'Latencia media', value: report.avgRecognitionMs ? `${Math.round(report.avgRecognitionMs)} ms` : '—', icon: Timer, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
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

          {/* Asistencia por clase */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Asistencia por clase</h4>
            {report.byClass.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">Sin clases con registros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                      <th className="p-3">Materia</th>
                      <th className="p-3">Docente</th>
                      <th className="p-3">Lab</th>
                      <th className="p-3 text-center">Inscritos</th>
                      <th className="p-3 text-center">Presentes</th>
                      <th className="p-3 text-center">Fuera horario</th>
                      <th className="p-3 text-center">Ausentes</th>
                      <th className="p-3 text-center">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byClass.map(r => (
                      <tr key={r.scheduleId} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="p-3 font-semibold text-zinc-900 dark:text-white">{r.subject}</td>
                        <td className="p-3 text-zinc-600 dark:text-zinc-300">{r.teacherName ?? '—'}</td>
                        <td className="p-3 font-mono text-zinc-500 dark:text-zinc-400">{r.labCode}</td>
                        <td className="p-3 text-center text-zinc-600 dark:text-zinc-300">{r.expected}</td>
                        <td className="p-3 text-center text-green-600 dark:text-green-400 font-semibold">{r.present}</td>
                        <td className="p-3 text-center text-amber-600 dark:text-amber-400">{r.outOfWindow}</td>
                        <td className="p-3 text-center text-red-600 dark:text-red-400">{r.absent}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-label font-bold ${r.attendanceRate >= 70 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : r.attendanceRate >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{r.attendanceRate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Más retrasos */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendDown className="w-4 h-4 text-amber-500" weight="fill" />
                Más retrasos
              </h4>
              {report.topLate.length === 0 ? <p className="text-xs text-zinc-400 py-4">Sin registros.</p> : (
                <div className="space-y-2">
                  {report.topLate.slice(0, 6).map((t, i) => (
                    <div key={t.studentId + i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300 truncate">{t.studentName}</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Más rechazos */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <WarningOctagon className="w-4 h-4 text-red-500" weight="fill" />
                Más rechazos
              </h4>
              {report.topDenials.length === 0 ? <p className="text-xs text-zinc-400 py-4">Sin registros.</p> : (
                <div className="space-y-2">
                  {report.topDenials.slice(0, 6).map((t, i) => (
                    <div key={t.studentId + i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300 truncate">{t.studentName}</span>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incidentes por laboratorio */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Incidentes por laboratorio</h4>
              {report.incidentsByLab.length === 0 ? <p className="text-xs text-zinc-400 py-4">Sin incidentes.</p> : (
                <div className="space-y-2">
                  {report.incidentsByLab.map(i => (
                    <div key={i.labCode} className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{i.labCode}</span>
                      <span className="flex gap-2">
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">{i.open} abiertos</span>
                        <span className="font-mono text-zinc-400">{i.closed} cerrados</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
