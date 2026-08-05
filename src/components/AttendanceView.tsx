'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckSquare, CircleNotch, MagnifyingGlass, X,
} from '@phosphor-icons/react';
import type { Attendance, Student, Schedule } from '../types.ts';
import { api } from '../lib/api.ts';

const STATUS_BADGE: Record<Attendance['status'], { label: string; cls: string }> = {
  presente: { label: 'Presente', cls: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' },
  fuera_de_horario: { label: 'Fuera de horario', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' },
  ausente: { label: 'Ausente', cls: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' },
};

export default function AttendanceView() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Attendance['status']>('all');

  useEffect(() => {
    Promise.all([api.getAttendance(), api.getStudents().catch(() => []), api.getSchedules().catch(() => [])])
      .then(([a, st, sc]) => { setRecords(a); setStudents(st); setSchedules(sc); })
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar asistencia'))
      .finally(() => setLoading(false));
  }, []);

  const studentName = (id: string) => students.find(s => s.id === id)?.name || id;
  const scheduleSubject = (id: string) => schedules.find(s => s.id === id)?.subject || records.find(r => r.scheduleId === id)?.subject || id;

  const filtered = records.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesQuery = !query || studentName(r.studentId).toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Control de Asistencia</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Ingresos registrados por el kiosco en las clases en curso.</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm text-xs">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
          <input type="text" placeholder="Buscar estudiante..." value={query} onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer">
          <option value="all">Todos los estados</option>
          <option value="presente">Presentes</option>
          <option value="fuera_de_horario">Fuera de horario</option>
          <option value="ausente">Ausentes</option>
        </select>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
            <p className="text-sm">Cargando asistencia...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
            <CheckSquare className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Sin registros de asistencia</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Los ingresos de los kioscos aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                  <th className="p-4">Estudiante</th>
                  <th className="p-4">Materia</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Hora</th>
                  <th className="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 font-semibold text-zinc-900 dark:text-white">{studentName(r.studentId)}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-300 truncate max-w-[200px]" title={scheduleSubject(r.scheduleId)}>{scheduleSubject(r.scheduleId)}</td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400">{r.date}</td>
                    <td className="p-4 font-mono text-zinc-600 dark:text-zinc-300">{r.time}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${STATUS_BADGE[r.status].cls}`}>{STATUS_BADGE[r.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
