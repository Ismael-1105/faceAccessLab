'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarBlank, Plus, X, PencilSimple, Trash, CircleNotch, CheckCircle,
  Users as UsersIcon, Clock, Flask, GraduationCap, Play, StopCircle, MagnifyingGlass,
} from '@phosphor-icons/react';
import type { Schedule, Enrollment, Lab, Student as StudentT, AdminUser } from '../types.ts';
import { api, getToken } from '../lib/api.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const inputClass =
  'w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all';

type ModalState = { type: 'none' } | { type: 'create' } | { type: 'edit'; schedule: Schedule };

const STATUS_LABEL: Record<Schedule['status'], string> = {
  programada: 'Programada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export default function SchedulesView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [students, setStudents] = useState<StudentT[]>([]);
  const [role, setRole] = useState<'admin' | 'docente' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [enrollOpenFor, setEnrollOpenFor] = useState<Schedule | null>(null);
  const [enrollStudent, setEnrollStudent] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [registerOpenFor, setRegisterOpenFor] = useState<Schedule | null>(null);
  const [regForm, setRegForm] = useState({ name: '', lastName: '' });
  const [regSaving, setRegSaving] = useState(false);
  const [regError, setRegError] = useState('');

  const [form, setForm] = useState({
    subject: '', teacherId: '', labCode: '', dayOfWeek: 1, startTime: '08:00', endTime: '10:00',
  });

  const load = async () => {
    setLoading(true);
    try {
      // El rol se descifra del JWT para saber qué recursos puede consultar.
      let isDocenteUser = false;
      try {
        const token = getToken();
        const payload = token ? JSON.parse(atob(token.split('.')[1])) : null;
        setRole(payload?.role ?? null);
        isDocenteUser = payload?.role === 'docente';
      } catch { setRole(null); }

      // Un docente no puede consultar la lista de docentes (es solo admin);
      // resuelve el resto en paralelo.
      const [s, e, l, st, t] = await Promise.all([
        api.getSchedules(),
        api.getEnrollments(),
        api.getLabs(),
        api.getStudents(),
        isDocenteUser ? Promise.resolve([]) : api.getUsers().catch(() => []),
      ]);
      setSchedules(s); setEnrollments(e); setLabs(l); setStudents(st); setTeachers(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planificación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ subject: '', teacherId: teachers[0]?.id || '', labCode: labs[0]?.code || '', dayOfWeek: 1, startTime: '08:00', endTime: '10:00' });
    setFormError('');
    setModal({ type: 'create' });
  };

  const openEdit = (schedule: Schedule) => {
    setForm({ subject: schedule.subject, teacherId: schedule.teacherId, labCode: schedule.labCode, dayOfWeek: schedule.dayOfWeek, startTime: schedule.startTime, endTime: schedule.endTime });
    setFormError('');
    setModal({ type: 'edit', schedule });
  };

  const handleSave = async () => {
    if (!form.subject.trim() || !form.teacherId || !form.labCode) {
      setFormError('Completa materia, docente y laboratorio');
      return;
    }
    if (form.endTime <= form.startTime) {
      setFormError('La hora de fin debe ser posterior a la de inicio');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (modal.type === 'create') {
        await api.createSchedule(form);
        setNotice('Clase creada correctamente.');
      } else if (modal.type === 'edit') {
        await api.updateSchedule(modal.schedule.id, form);
        setNotice('Clase actualizada.');
      }
      await load();
      setModal({ type: 'none' });
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar clase');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSchedule(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('Clase eliminada.');
      await load();
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const handleEnroll = async () => {
    if (!enrollOpenFor || !enrollStudent) return;
    try {
      await api.createEnrollment({ scheduleId: enrollOpenFor.id, studentId: enrollStudent });
      setEnrollStudent('');
      setEnrollOpenFor(null);
      setNotice('Estudiante inscrito.');
      await load();
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al inscribir');
    }
  };

  const teacherName = (id: string) => teachers.find(t => t.id === id)?.name || '—';
  const enrollCount = (scheduleId: string) => enrollments.filter(e => e.scheduleId === scheduleId && e.active).length;

  // F9: búsqueda rápida de clases por materia, lab o docente.
  const filteredSchedules = schedules.filter(s => {
    const q = scheduleSearch.toLowerCase();
    if (!q) return true;
    return s.subject.toLowerCase().includes(q) ||
      s.labCode.toLowerCase().includes(q) ||
      teacherName(s.teacherId).toLowerCase().includes(q);
  });

  /** Inicia/finaliza la sesión de la clase (estado de sesión). */
  const changeStatus = async (schedule: Schedule, status: Schedule['status']) => {
    try {
      await api.updateSchedule(schedule.id, { status });
      setNotice(status === 'en_curso' ? `Sesión iniciada: ${schedule.subject}` : `Sesión finalizada: ${schedule.subject}`);
      await load();
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    }
  };

  /**
   * Registra un estudiante en la clase del docente sin pedir el laboratorio:
   * se hereda automáticamente de la clase y el permiso queda definido por su
   * horario (dayOfWeek + startTime/endTime) vía canAccessLab.
   */
  const handleRegisterStudent = async () => {
    if (!registerOpenFor) return;
    if (!regForm.name.trim()) {
      setRegError('Completa el nombre del estudiante');
      return;
    }
    setRegSaving(true);
    setRegError('');
    try {
      const fullName = `${regForm.name.trim()}${regForm.lastName.trim() ? ' ' + regForm.lastName.trim() : ''}`;
      const initials = fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'N';
      await api.createStudent({
        name: fullName,
        career: 'Ingeniería en Tecnologías de la Información (TIC)',
        avatarInitials: initials,
        scheduleId: registerOpenFor.id,
      });
      setNotice(`Estudiante registrado en ${registerOpenFor.subject} — lab y horario heredados.`);
      setRegisterOpenFor(null);
      setRegForm({ name: '', lastName: '' });
      await load();
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Error al registrar estudiante');
    } finally {
      setRegSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Planificación de Clases</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">El acceso al laboratorio se autoriza según la clase "en curso" y la inscripción del estudiante.</p>
        </div>
        {role !== 'docente' && (
          <button onClick={openCreate}
            className="bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 py-2.5 text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer">
            <Plus className="w-4 h-4" weight="bold" />
            Nueva clase
          </button>
        )}
      </div>

      {notice && (
        <div role="status" className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-green-800 dark:text-green-300 font-medium">{notice}</p>
        </div>
      )}
      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {/* F9: buscador de clases */}
      <div className="relative w-full sm:max-w-xs">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
        <input type="text" placeholder="Buscar por materia, lab o docente..." value={scheduleSearch} onChange={e => setScheduleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
            <p className="text-sm">Cargando planificación...</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="col-span-full py-14 text-center text-zinc-400 dark:text-zinc-500">
            <CalendarBlank className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{scheduleSearch ? 'Sin clases que coincidan con la búsqueda' : 'No hay clases planificadas'}</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">{scheduleSearch ? 'Prueba con otra materia, lab o docente.' : 'Crea la primera con "Nueva clase".'}</p>
          </div>
        ) : (
          filteredSchedules.map(schedule => {
            const status = schedule.status ?? 'programada';
            const isTeacher = role === 'docente';
            return (
            <div key={schedule.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm transition-all ${schedule.active ? 'border-zinc-200 dark:border-zinc-800' : 'border-dashed border-zinc-300 dark:border-zinc-700 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-zinc-900 dark:text-white truncate">{schedule.subject}</h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{DAYS[schedule.dayOfWeek]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    status === 'en_curso' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : status === 'finalizada' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    : status === 'cancelada' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>{STATUS_LABEL[status]}</span>
                  {!isTeacher && (
                    <>
                      <button onClick={() => openEdit(schedule)} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-accent-600 transition-all cursor-pointer" aria-label="Editar"><PencilSimple className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(schedule)} className="p-2 rounded-xl text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all cursor-pointer" aria-label="Eliminar"><Trash className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <UsersIcon className="w-3.5 h-3.5 shrink-0" weight="regular" />
                  {teacherName(schedule.teacherId)}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Flask className="w-3.5 h-3.5 shrink-0" weight="regular" />
                  {schedule.labCode}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <Clock className="w-3.5 h-3.5 shrink-0" weight="regular" />
                  {schedule.startTime} – {schedule.endTime}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                <span className="text-label font-semibold text-zinc-400 dark:text-zinc-500">{enrollCount(schedule.id)} inscritos</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setRegisterOpenFor(schedule)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-accent-50 dark:hover:bg-accent-950/30 text-zinc-600 dark:text-zinc-300 hover:text-accent-700 transition-all cursor-pointer"
                    title="Registrar estudiante (hereda lab y horario)">
                    <GraduationCap className="w-3.5 h-3.5 inline mr-1" weight="fill" />
                    Registrar
                  </button>
                  {isTeacher && status !== 'cancelada' && (
                    status === 'en_curso'
                      ? <button onClick={() => changeStatus(schedule, 'finalizada')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center gap-1.5 transition-all cursor-pointer"><StopCircle className="w-3.5 h-3.5" weight="fill" /> Finalizar</button>
                      : <button onClick={() => changeStatus(schedule, 'en_curso')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 text-green-700 dark:text-green-400 flex items-center gap-1.5 transition-all cursor-pointer"><Play className="w-3.5 h-3.5" weight="fill" /> Iniciar sesión</button>
                  )}
                  {!isTeacher && (
                    <button onClick={() => setEnrollOpenFor(schedule)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-accent-50 dark:hover:bg-accent-950/30 text-zinc-600 dark:text-zinc-300 hover:text-accent-700 transition-all cursor-pointer">
                      Inscribir
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Modal crear/editar */}
      <AnimatePresence>
        {modal.type !== 'none' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setModal({ type: 'none' })}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">{modal.type === 'create' ? 'Nueva clase' : 'Editar clase'}</h3>
                  <button onClick={() => !saving && setModal({ type: 'none' })} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl transition-all cursor-pointer" aria-label="Cerrar"><X className="w-4 h-4" weight="bold" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Materia</label>
                    <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Ej. Sistemas Operativos" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Docente</label>
                      <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} className={`${inputClass} cursor-pointer`}>
                        <option value="">Seleccionar</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Laboratorio</label>
                      <select value={form.labCode} onChange={e => setForm({ ...form, labCode: e.target.value })} className={`${inputClass} cursor-pointer`}>
                        <option value="">Seleccionar</option>
                        {labs.filter(l => l.active).map(l => <option key={l.code} value={l.code}>{l.code}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Día</label>
                    <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: Number(e.target.value) })} className={`${inputClass} cursor-pointer`}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Inicio</label>
                      <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Fin</label>
                      <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </div>
                {formError && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{formError}</p>}
                <div className="flex gap-2.5">
                  <button onClick={() => !saving && setModal({ type: 'none' })} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 transition-all cursor-pointer disabled:opacity-50">Cancelar</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent-600 hover:bg-accent-700 text-white transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />}
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal inscribir estudiante */}
      <AnimatePresence>
        {enrollOpenFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEnrollOpenFor(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" weight="fill" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">Inscribir estudiante</h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{enrollOpenFor.subject} · {DAYS[enrollOpenFor.dayOfWeek]} {enrollOpenFor.startTime}–{enrollOpenFor.endTime}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Estudiante</label>
                  <select value={enrollStudent} onChange={e => setEnrollStudent(e.target.value)} className={`${inputClass} cursor-pointer`}>
                    <option value="">Seleccionar</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.career}</option>)}
                  </select>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => setEnrollOpenFor(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 transition-all cursor-pointer">Cancelar</button>
                  <button onClick={handleEnroll} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent-600 hover:bg-accent-700 text-white transition-all active:scale-[0.98] cursor-pointer">Inscribir</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal registrar estudiante (hereda lab y horario de la clase) */}
      <AnimatePresence>
        {registerOpenFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !regSaving && setRegisterOpenFor(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" weight="fill" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">Registrar estudiante</h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{registerOpenFor.subject} · {DAYS[registerOpenFor.dayOfWeek]} {registerOpenFor.startTime}–{registerOpenFor.endTime}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-accent-50 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-800/40 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-accent-800 dark:text-accent-300 flex items-center gap-1.5">
                    <Flask className="w-3.5 h-3.5" weight="fill" /> Lab: {registerOpenFor.labCode}
                  </p>
                  <p className="text-caption text-accent-700 dark:text-accent-400">
                    El lab y el horario se heredan de esta clase. El estudiante podrá acceder solo en esas horas.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Nombre</label>
                      <input type="text" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} placeholder="Ej. María" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Apellido</label>
                      <input type="text" value={regForm.lastName} onChange={e => setRegForm({ ...regForm, lastName: e.target.value })} placeholder="Ej. Pérez" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Carrera</label>
                    <input type="text" readOnly value="Ingeniería en Tecnologías de la Información (TIC)"
                      className={`${inputClass} bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 cursor-not-allowed`} />
                  </div>
                </div>

                {regError && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{regError}</p>}

                <div className="flex gap-2.5">
                  <button onClick={() => setRegisterOpenFor(null)} disabled={regSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 transition-all cursor-pointer disabled:opacity-50">Cancelar</button>
                  <button onClick={handleRegisterStudent} disabled={regSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent-600 hover:bg-accent-700 text-white transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {regSaving && <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />}
                    {regSaving ? 'Registrando...' : 'Registrar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar clase"
        message={`¿Eliminar la clase "${deleteTarget?.subject}"? Se eliminarán también las inscripciones asociadas.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
