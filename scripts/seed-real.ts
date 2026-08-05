/**
 * Poblamiento académico real vía las APIs del proyecto.
 *
 * Fuente: docs/datos-estudiante.md
 * - Reutiliza docentes por coincidencia de tokens (independiente del orden).
 * - Reutiliza estudiantes similares; elimina los ficticios sin coincidencia.
 * - Crea estudiantes únicos y sus Enrollment.
 * - Actualiza las clases con modalidad (presencial/virtual).
 * - Todos los estudiantes quedan con biometricStatus = 'pending'.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:3000/api';
const TIC = 'Ingeniería en Tecnologías de la Información (TIC)';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, '..', 'docs', 'datos-estudiante.md');

async function request(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

/** Tokens normalizados de un nombre (sin acentos, minúsculas). */
function tokens(name: string): string[] {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').split(/[^a-z]+/).filter(Boolean);
}

/** Normalización por conjunto de tokens, orden independiente. */
function tokenKey(name: string): string {
  return tokens(name).sort().join(' ');
}

/** ¿Dos nombres coinciden por tokens (misma persona)? */
function samePerson(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const inter = ta.filter(t => setB.has(t)).length;
  const min = Math.min(ta.length, tb.length);
  return inter >= Math.max(2, min - 1); // tolera omisión de un token (apellido extra)
}

const report: Record<string, unknown> = {
  docentes: { reutilizados: [], actualizados: [], creados: [] },
  estudiantes: { creados: [], reutilizados: [], eliminadosFicticios: [] },
  inscripcionesPorMateria: {} as Record<string, number>,
  materiasPresenciales: [] as string[],
  materiasVirtuales: [] as string[],
  conflictos: [] as string[],
};

interface SubjectData { subject: string; section: string; teacher: string; students: string[]; }

function parseSource(): SubjectData[] {
  const text = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
  const subjects: SubjectData[] = [];
  // Divide por cada encabezado de materia "# ..." manteniendo su sección completa.
  const sections = text.split(/\n(?=# )/).filter(s => s.includes('## Profesor'));
  for (const sec of sections) {
    const subject = (sec.match(/^#\s+(.+)/) || [])[1]?.trim() || '';
    const section = (sec.match(/\*\*Sección:\*\*\s*(.+)/i) || [])[1]?.trim() || '';
    const teacher = (sec.match(/## Profesor\s*\n-\s*(.+)/i) || [])[1]?.trim() || '';
    const students = [...sec.matchAll(/^\d+\.\s+(.+)$/gm)].map(m => m[1].trim());
    if (subject && teacher) subjects.push({ subject, section, teacher, students });
  }
  return subjects;
}

async function main() {
  const login = await request('/auth/login', { method: 'POST', body: { email: 'admin@faceaccess.lab', password: 'admin123' } });
  if (login.status !== 200) throw new Error(`Login admin falló: ${login.status}`);
  const token = (login.data as { token: string }).token;

  const subjects = parseSource();
  const virtuals = ['Gestión de Calidad de Software', 'Computación Forense', 'Legislación Informática'];
  const presencialMap: Record<string, { lab: string; parallel: string }> = {
    'Programación en la Nube': { lab: 'LAB-02', parallel: '7-ITIL-A' },
    'Interacción Hombre Computadora': { lab: 'LAB-03', parallel: '7-ITIL-A' },
    'Simulación y Realidad Virtual': { lab: 'AULA-B4', parallel: '6-ITIL-A' },
  };

  // ── 1. Docentes: reutilizar por tokens ───────────────────────────────────
  const existingUsers = (await request('/users', { token })).data as { id: string; email: string; name: string }[];
  const teacherNames = Array.from(new Set(subjects.map(s => s.teacher).filter(Boolean)));
  const teacherIds = new Map<string, string>();

  for (const name of teacherNames) {
    const match = existingUsers.find(u => u.role === 'docente' && samePerson(u.name, name));
    if (match) {
      // Actualizar solo el nombre si el almacenado está en otro orden.
      const wasRenamed = tokenKey(match.name) !== tokenKey(name) || match.name !== name;
      report.docentes.reutilizados.push(`${match.name} ← ${name}`);
      if (wasRenamed) {
        await request('/users', { method: 'PUT', token, body: { id: match.id, name } });
        report.docentes.actualizados.push(name);
        match.name = name;
      }
      teacherIds.set(name, match.id);
      continue;
    }
    const email = tokens(name).join('.') + '@faceaccess.lab';
    const res = await request('/users', { method: 'POST', token, body: { email, password: 'docente123', name } });
    if (res.status === 201) {
      const id = (res.data as { user: { id: string } }).user.id;
      report.docentes.creados.push(name);
      teacherIds.set(name, id);
    } else {
      throw new Error(`Error creando docente ${name}: ${res.status} ${JSON.stringify(res.data)}`);
    }
  }

  // ── 2. Clases: mapear por materia y fijar modalidad ──────────────────────
  const schedules = (await request('/schedules', { token })).data as { id: string; subject: string; teacherId: string; labCode: string; parallel?: string }[];
  const scheduleIds = new Map<string, string>();

  for (const subject of subjects) {
    const isVirtual = virtuals.includes(subject.subject);
    const isPresencial = subject.subject in presencialMap;
    const teacherId = teacherIds.get(subject.teacher);
    if (!teacherId) { report.conflictos.push(`Clase ${subject.subject} sin docente mapeado`); continue; }

    const sched = schedules.find(s => s.subject === subject.subject) || schedules.find(s => s.subject.toLowerCase() === subject.subject.toLowerCase());
    const lab = isPresencial ? presencialMap[subject.subject].lab : (sched?.labCode || 'VIRTUAL');
    const parallel = isPresencial ? presencialMap[subject.subject].parallel : subject.section || sched?.parallel || 'A';
    const body = {
      subject: subject.subject,
      teacherId,
      labCode: lab,
      dayOfWeek: sched?.dayOfWeek ?? 1,
      startTime: sched?.startTime ?? '15:00',
      endTime: sched?.endTime ?? '18:00',
      parallel,
      campus: 'UIO',
      academicTerm: '2026-A',
      active: true,
      deliveryMode: isVirtual ? 'virtual' : 'presencial',
      requiresPhysicalAccess: !isVirtual,
      activeKiosk: !isVirtual,
    };

    let id = sched?.id;
    if (!id) {
      const res = await request('/schedules', { method: 'POST', token, body });
      if (res.status !== 201) throw new Error(`Error creando clase ${subject.subject}: ${res.status} ${JSON.stringify(res.data)}`);
      id = (res.data as { schedule: { id: string } }).schedule.id;
    } else {
      const res = await request('/schedules', { method: 'PUT', token, body: { id, ...body } });
      if (res.status !== 200 && res.status !== 201) throw new Error(`Error actualizando clase ${subject.subject}: ${res.status}`);
    }
    scheduleIds.set(subject.subject, id!);
    if (isVirtual) { if (!report.materiasVirtuales.includes(subject.subject)) report.materiasVirtuales.push(subject.subject); }
    else if (isPresencial) { if (!report.materiasPresenciales.includes(subject.subject)) report.materiasPresenciales.push(subject.subject); }
    report.inscripcionesPorMateria[subject.subject] = subject.students.length;
  }

  // ── 3. Estudiantes únicos por nombre ─────────────────────────────────────
  const seen = new Map<string, { name: string; subjects: string[] }>();
  for (const subj of subjects) for (const st of subj.students) {
    const key = tokenKey(st);
    if (!seen.has(key)) seen.set(key, { name: st, subjects: [] });
    if (!seen.get(key)!.subjects.includes(subj.subject)) seen.get(key)!.subjects.push(subj.subject);
  }
  const uniqueStudents = Array.from(seen.values());
  console.log(`[Parse] ${uniqueStudents.length} estudiantes únicos`);

  const existingStudents = (await request('/students', { token })).data as { id: string; name: string; career: string }[];
  const realTokens = uniqueStudents.map(s => tokenKey(s.name));
  const usedExisting = new Set<string>();

  // 3a. Eliminar estudiantes ficticios que no coinciden con ningún real.
  for (const prev of existingStudents) {
    const matches = realTokens.some(rt => samePerson(rt, tokenKey(prev.name)));
    if (!matches) {
      await request('/students', { method: 'DELETE', token, body: { id: prev.id } });
      report.estudiantes.eliminadosFicticios.push(prev.name);
    }
  }

  // 3b. Reutilizar o crear cada estudiante real.
  const studentsAfter = (await request('/students', { token })).data as { id: string; name: string; career: string }[];
  for (const st of uniqueStudents) {
    const prev = studentsAfter.find(s => samePerson(s.name, st.name));
    if (prev) {
      report.estudiantes.reutilizados.push(st.name);
      usedExisting.add(prev.id);
      continue;
    }
    const initials = tokens(st.name).map(t => t[0]).join('').toUpperCase().slice(0, 2) || 'N';
    const res = await request('/students', { method: 'POST', token, body: { name: st.name, career: TIC, avatarInitials: initials, biometricStatus: 'pending' } });
    if (res.status !== 201) { report.conflictos.push(`Error creando estudiante ${st.name}: ${res.status} ${JSON.stringify(res.data)}`); continue; }
    report.estudiantes.creados.push(st.name);
    usedExisting.add((res.data as { id: string }).id);
  }

  // ── 4. Inscripciones (idempotentes) ─────────────────────────────────────
  const finalStudents = (await request('/students', { token })).data as { id: string; name: string; career: string }[];
  const finalSchedules = (await request('/schedules', { token })).data as { id: string; subject: string }[];
  for (const subj of subjects) {
    const scheduleId = scheduleIds.get(subj.subject) || finalSchedules.find(s => s.subject === subj.subject)?.id;
    if (!scheduleId) { report.conflictos.push(`Sin scheduleId para ${subj.subject}`); continue; }
    for (const st of subj.students) {
      const student = finalStudents.find(s => samePerson(s.name, st));
      if (!student) { report.conflictos.push(`Estudiante ${st} no encontrado para inscripción`); continue; }
      const res = await request('/enrollments', { method: 'POST', token, body: { scheduleId, studentId: student.id } });
      if (res.status === 409) { /* idempotente */ }
      else if (res.status !== 201) { report.conflictos.push(`Enrollment fallido ${st} → ${subj.subject}: ${res.status}`); }
    }
  }

  console.log('\n=== INFORME DE POBLAMIENTO REAL ===');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error('[Seed] ERROR:', e.message || e); process.exit(1); });
