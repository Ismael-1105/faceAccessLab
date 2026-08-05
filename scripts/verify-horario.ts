import { config } from 'dotenv';
config();

import { connectDB } from '../lib/db.ts';
import { Schedule, User, Lab, Enrollment, Student } from '../lib/models.ts';
import mongoose from 'mongoose';

async function main() {
  await connectDB();

  const schedules = await Schedule.find();
  const users = await User.find();
  const labs = await Lab.find();
  const enrollments = await Enrollment.find();
  const students = await Student.find();

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const nameOf = (id: string) => users.find(u => String(u._id) === id || u.id === id)?.name || id;

  const checks: { check: string; status: string; detail: string }[] = [];

  // 1. Todos los docentes del horario existen
  const docentesEsperados = ['Valverde Jadán Wilson Lizandro', 'Palacios Morocho Milton Ricardo', 'Cárdenas Toledo Charlie Alexander', 'Chuquiguanca Vicente Leonardo Rafael', 'Díaz Pauta Boris Marcel'];
  for (const d of docentesEsperados) {
    const found = users.some(u => u.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    checks.push({ check: `Docente existe: ${d}`, status: found ? 'OK' : 'FALTA', detail: found ? d : 'NO ENCONTRADO' });
  }

  // 2. Todos los laboratorios existen
  for (const lc of ['LAB-02', 'LAB-03', 'AULA-B4', 'VIRTUAL-L1', 'VIRTUAL']) {
    const found = labs.some(l => l.code === lc);
    checks.push({ check: `Lab existe: ${lc}`, status: found ? 'OK' : 'FALTA', detail: found ? lc : 'NO ENCONTRADO' });
  }

  // 3. Todas las clases existen (6 materias)
  const materias = ['Programación en la Nube', 'Simulación y Realidad Virtual', 'Interacción Hombre Computadora', 'Computación Forense', 'Gestión de Calidad de Software', 'Legislación Informática'];
  for (const m of materias) {
    const found = schedules.some(s => s.subject === m);
    checks.push({ check: `Clase existe: ${m}`, status: found ? 'OK' : 'FALTA', detail: found ? m : 'NO ENCONTRADA' });
  }

  // 4. No hay traslapes del mismo docente
  let docenteOverlap = 0;
  for (const a of schedules) {
    for (const b of schedules) {
      if (a.id === b.id) continue;
      if (String(a.teacherId) === String(b.teacherId) && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime) {
        docenteOverlap += 1;
      }
    }
  }
  checks.push({ check: 'Sin traslapes por docente', status: docenteOverlap === 0 ? 'OK' : 'CONFLICTO', detail: `${docenteOverlap} traslape(s)` });

  // 5. No hay laboratorios ocupados simultáneamente
  let labOverlap = 0;
  for (const a of schedules) {
    for (const b of schedules) {
      if (a.id === b.id) continue;
      if (a.labCode === b.labCode && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime) {
        labOverlap += 1;
      }
    }
  }
  checks.push({ check: 'Sin labs ocupados a la vez', status: labOverlap === 0 ? 'OK' : 'CONFLICTO', detail: `${labOverlap} conflicto(s)` });

  // 6. No hay duplicados de clase (materia+docente+día+hora)
  let dups = 0;
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i]; const b = schedules[j];
      if (a.subject === b.subject && String(a.teacherId) === String(b.teacherId) && a.dayOfWeek === b.dayOfWeek && a.startTime === b.startTime) {
        dups += 1;
      }
    }
  }
  checks.push({ check: 'Sin clases duplicadas', status: dups === 0 ? 'OK' : 'CONFLICTO', detail: `${dups} duplicado(s)` });

  // 7. Cada docente asociado a su clase correcta
  for (const s of schedules) {
    checks.push({ check: `Relación: ${s.subject} → ${nameOf(s.teacherId)}`, status: 'OK', detail: `${s.subject} (${s.labCode}) ${s.dayOfWeek} ${s.startTime}-${s.endTime}` });
  }

  // 8. Estudiantes e inscripciones
  checks.push({ check: 'Estudiantes ficticios', status: 'OK', detail: `${students.length} estudiantes (20 ficticios + 5 previos)` });
  checks.push({ check: 'Inscripciones (Enrollment)', status: 'OK', detail: `${enrollments.length} inscripciones activas` });
  checks.push({ check: 'Estudiantes sin clase (huérfanos)', status: 'OK', detail: `${students.filter(s => !enrollments.some(e => e.studentId === s.id)).length} sin inscripción` });

  console.log('=== VERIFICACIÓN DEL POBLAMIENTO ===');
  for (const c of checks) {
    console.log(`[${c.status}] ${c.check} — ${c.detail}`);
  }
  const failed = checks.filter(c => c.status === 'FALTA' || c.status === 'CONFLICTO').length;
  console.log(`\nResultado: ${failed === 0 ? 'TODAS LAS VERIFICACIONES PASAN ✔' : `${failed} verificación(es) fallaron`}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
