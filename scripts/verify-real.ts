import { config } from 'dotenv';
config();

import { connectDB } from '../lib/db.ts';
import { Student, Enrollment, User, Schedule, Lab } from '../lib/models.ts';
import mongoose from 'mongoose';

function tokens(name: string): string[] {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').split(/[^a-z]+/).filter(Boolean);
}

async function main() {
  await connectDB();

  const checks: { check: string; status: string; detail: string }[] = [];

  // 1. No estudiantes duplicados (por tokens de nombre).
  const students = await Student.find();
  const byKey = new Map<string, number>();
  students.forEach(s => {
    const k = tokens(s.name).sort().join(' ');
    byKey.set(k, (byKey.get(k) || 0) + 1);
  });
  const dupStudents = [...byKey.entries()].filter(([, n]) => n > 1);
  checks.push({ check: 'Estudiantes duplicados', status: dupStudents.length === 0 ? 'OK' : 'CONFLICTO', detail: dupStudents.length ? `${dupStudents.length} duplicados` : `${students.length} únicos` });

  // 2. No docentes duplicados.
  const docentes = await User.find({ role: 'docente' });
  const docKey = new Map<string, number>();
  docentes.forEach(d => {
    const k = tokens(d.name).sort().join(' ');
    docKey.set(k, (docKey.get(k) || 0) + 1);
  });
  const dupDocentes = [...docKey.entries()].filter(([, n]) => n > 1);
  checks.push({ check: 'Docentes duplicados', status: dupDocentes.length === 0 ? 'OK' : 'CONFLICTO', detail: dupDocentes.length ? `${dupDocentes.length} duplicados` : `${docentes.length} docentes` });

  // 3. No Enrollment duplicados.
  const enrollments = await Enrollment.find();
  const enrKey = new Set<string>();
  let dupEnroll = 0;
  for (const e of enrollments) {
    const k = `${e.scheduleId}|${e.studentId}`;
    if (enrKey.has(k)) dupEnroll += 1;
    enrKey.add(k);
  }
  checks.push({ check: 'Enrollment duplicados', status: dupEnroll === 0 ? 'OK' : 'CONFLICTO', detail: dupEnroll ? `${dupEnroll} duplicados` : `${enrollments.length} inscripciones` });

  // 4. Todos los horarios tienen docente.
  const schedules = await Schedule.find();
  const docIds = new Set(docentes.map(d => String(d._id)));
  const sinDocente = schedules.filter(s => !docIds.has(String(s.teacherId)));
  checks.push({ check: 'Horarios con docente', status: sinDocente.length === 0 ? 'OK' : 'CONFLICTO', detail: sinDocente.length ? `${sinDocente.length} sin docente` : `${schedules.length} horarios` });

  // 5. Horarios presenciales con lab válido.
  const labs = await Lab.find();
  const labCodes = new Set(labs.map(l => l.code));
  const presencialSinLab = schedules.filter(s => s.requiresPhysicalAccess !== false && !labCodes.has(s.labCode));
  checks.push({ check: 'Presenciales con lab válido', status: presencialSinLab.length === 0 ? 'OK' : 'CONFLICTO', detail: presencialSinLab.length ? `${presencialSinLab.length} sin lab` : 'OK' });

  // 6. Virtuales no aparecen en kiosco (activeKiosk=false).
  const virtualConKiosk = schedules.filter(s => s.deliveryMode === 'virtual' && s.activeKiosk !== false);
  checks.push({ check: 'Virtuales fuera del kiosco', status: virtualConKiosk.length === 0 ? 'OK' : 'CONFLICTO', detail: virtualConKiosk.length ? `${virtualConKiosk.length} con activeKiosk` : 'OK' });

  // 7. Estudiantes con biometría pending.
  const notPending = students.filter(s => s.biometricStatus !== 'pending');
  checks.push({ check: 'Biometría pending', status: notPending.length === 0 ? 'OK' : 'CONFLICTO', detail: notPending.length ? `${notPending.length} no-pending` : `${students.length} pending` });

  // 8. Estudiantes correctamente relacionados con sus materias.
  const sinEnrollment = students.filter(s => !enrollments.some(e => e.studentId === s.id));
  checks.push({ check: 'Estudiantes con inscripción', status: sinEnrollment.length === 0 ? 'OK' : 'AVISO', detail: sinEnrollment.length ? `${sinEnrollment.length} sin inscripción` : 'Todos inscritos' });

  console.log('=== VERIFICACIÓN ACADÉMICA REAL ===');
  for (const c of checks) console.log(`[${c.status}] ${c.check} — ${c.detail}`);
  console.log('\n--- MATERIAS ---');
  for (const s of schedules) {
    console.log(`  ${s.subject} | ${s.deliveryMode} | activeKiosk=${s.activeKiosk} | ${s.labCode} | ${s.parallel || '—'}`);
  }
  const failed = checks.filter(c => c.status === 'CONFLICTO').length;
  console.log(`\nResultado: ${failed === 0 ? 'TODAS LAS VERIFICACIONES PASAN ✔' : `${failed} conflicto(s)`}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
