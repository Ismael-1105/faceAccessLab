/**
 * Poblamiento del horario oficial vía las APIs reales del proyecto.
 *
 * Respeta la arquitectura: usa POST/GET de /api/users, /api/labs, /api/terms,
 * /api/schedules, /api/students y /api/enrollments con autenticación admin.
 * NO inserta documentos directamente en MongoDB.
 *
 * Horario oficial (2026-A · Campus UIO · Paralelo A):
 *   Materia                              Docente                                    Lab(s)
 *   Programación en la Nube              Valverde Jadán Wilson Lizandro             LAB-02
 *   Simulación y Realidad Virtual        Palacios Morocho Milton Ricardo            AULA-B4
 *   Interacción Hombre Computadora       Cárdenas Toledo Charlie Alexander         LAB-03
 *   Computación Forense                  Chuquiguanca Vicente Leonardo Rafael      VIRTUAL-L1
 *   Gestión de Calidad de Software       Díaz Pauta Boris Marcel                    VIRTUAL
 *   Legislación Informática              Chuquiguanca Vicente Leonardo Rafael       VIRTUAL
 *
 * Bloque estándar: 15:00–18:00, un día por materia (Lun–Sáb), sin traslapes.
 */

const BASE = 'http://localhost:3000/api';
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

const report = {
  docentesCreados: [] as string[],
  docentesYaExistian: [] as string[],
  laboratoriosCreados: [] as string[],
  laboratoriosYaExistian: [] as string[],
  terminoCreado: null as string | null,
  clasesCreadas: [] as string[],
  clasesYaExistian: [] as string[],
  estudiantesCreados: [] as string[],
  inscripcionesCreadas: [] as string[],
  conflictos: [] as string[],
};

async function main() {
  const login = await request('/auth/login', { method: 'POST', body: { email: 'admin@faceaccess.lab', password: 'admin123' } });
  if (login.status !== 200) {
    throw new Error(`No se pudo autenticar admin: ${login.status} ${JSON.stringify(login.data)}`);
  }
  const token = (login.data as { token: string }).token;

  // ── 1. Período académico 2026-A ──────────────────────────────────────────
  const termRes = await request('/terms', { method: 'POST', token, body: { code: '2026-A', name: 'Primer Semestre 2026', isActive: true } });
  if (termRes.status === 201) { report.terminoCreado = (termRes.data as { code: string }).code; }
  else if (termRes.status === 409) { report.terminoCreado = '2026-A (ya existía)'; }
  else throw new Error(`Error creando término: ${termRes.status} ${JSON.stringify(termRes.data)}`);

  // ── 2. Docentes del horario ──────────────────────────────────────────────
  const docentes = [
    'Valverde Jadán Wilson Lizandro',
    'Palacios Morocho Milton Ricardo',
    'Cárdenas Toledo Charlie Alexander',
    'Chuquiguanca Vicente Leonardo Rafael',
    'Díaz Pauta Boris Marcel',
  ];
  const existingUsers = (await request('/users', { token })).data as { id: string; email: string; name: string }[];
  const docenteIds = new Map<string, string>();

  for (const nombre of docentes) {
    const email = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@faceaccess.lab';
    const prev = existingUsers.find(u => u.email.toLowerCase() === email);
    if (prev) {
      report.docentesYaExistian.push(nombre);
      docenteIds.set(nombre, prev.id);
      continue;
    }
    const res = await request('/users', { method: 'POST', token, body: { email, password: 'docente123', name: nombre } });
    if (res.status === 201) {
      const id = (res.data as { user: { id: string } }).user.id;
      report.docentesCreados.push(nombre);
      docenteIds.set(nombre, id);
    } else {
      throw new Error(`Error creando docente ${nombre}: ${res.status} ${JSON.stringify(res.data)}`);
    }
  }

  // ── 3. Laboratorios del horario ──────────────────────────────────────────
  const labsDef = [
    { code: 'AULA-B4', name: 'Aula B4' },
    { code: 'VIRTUAL-L1', name: 'Virtual L-1' },
    { code: 'VIRTUAL', name: 'Virtual' },
  ];
  const existingLabs = (await request('/labs', { token })).data as { code: string }[];
  const labCodes = new Set(existingLabs.map(l => l.code));

  for (const lab of labsDef) {
    if (labCodes.has(lab.code)) {
      report.laboratoriosYaExistian.push(lab.code);
      continue;
    }
    const res = await request('/labs', { method: 'POST', token, body: { code: lab.code, name: lab.name, active: true } });
    if (res.status === 201) {
      report.laboratoriosCreados.push(lab.code);
      labCodes.add(lab.code);
    } else {
      throw new Error(`Error creando lab ${lab.code}: ${res.status} ${JSON.stringify(res.data)}`);
    }
  }

  // ── 4. Clases (Schedules) del horario ────────────────────────────────────
  // Presenciales usan laboratorios físicos; virtuales quedan fuera del kiosco.
  const clases = [
    { subject: 'Programación en la Nube', teacher: 'Valverde Jadán Wilson Lizandro', labCode: 'LAB-02', dayOfWeek: 1, deliveryMode: 'presencial', requiresPhysicalAccess: true, activeKiosk: true },
    { subject: 'Simulación y Realidad Virtual', teacher: 'Palacios Morocho Milton Ricardo', labCode: 'AULA-B4', dayOfWeek: 2, deliveryMode: 'presencial', requiresPhysicalAccess: true, activeKiosk: true },
    { subject: 'Interacción Hombre Computadora', teacher: 'Cárdenas Toledo Charlie Alexander', labCode: 'LAB-03', dayOfWeek: 3, deliveryMode: 'presencial', requiresPhysicalAccess: true, activeKiosk: true },
    { subject: 'Computación Forense', teacher: 'Chuquiguanca Vicente Leonardo Rafael', labCode: 'VIRTUAL-L1', dayOfWeek: 4, deliveryMode: 'virtual', requiresPhysicalAccess: false, activeKiosk: false },
    { subject: 'Gestión de Calidad de Software', teacher: 'Díaz Pauta Boris Marcel', labCode: 'VIRTUAL', dayOfWeek: 5, deliveryMode: 'virtual', requiresPhysicalAccess: false, activeKiosk: false },
    { subject: 'Legislación Informática', teacher: 'Chuquiguanca Vicente Leonardo Rafael', labCode: 'VIRTUAL', dayOfWeek: 6, deliveryMode: 'virtual', requiresPhysicalAccess: false, activeKiosk: false },
  ];

  const existingSchedules = (await request('/schedules', { token })).data as { subject: string; teacherId: string; labCode: string }[];
  const scheduleIds = new Map<string, string>();

  for (const c of clases) {
    const teacherId = docenteIds.get(c.teacher);
    if (!teacherId) throw new Error(`Sin ID para docente ${c.teacher}`);
    const dup = existingSchedules.find(s => s.subject === c.subject && s.teacherId === teacherId && s.labCode === c.labCode);
    if (dup) {
      report.clasesYaExistian.push(c.subject);
      continue;
    }
    const res = await request('/schedules', {
      method: 'POST',
      token,
      body: {
        subject: c.subject,
        teacherId,
        labCode: c.labCode,
        dayOfWeek: c.dayOfWeek,
        startTime: '15:00',
        endTime: '18:00',
        parallel: 'A',
        campus: 'UIO',
        academicTerm: '2026-A',
        active: true,
        deliveryMode: c.deliveryMode,
        requiresPhysicalAccess: c.requiresPhysicalAccess,
        activeKiosk: c.activeKiosk,
      },
    });
    if (res.status === 201) {
      report.clasesCreadas.push(c.subject);
    } else {
      throw new Error(`Error creando clase ${c.subject}: ${res.status} ${JSON.stringify(res.data)}`);
    }
  }

  // Releer schedules con término para mapear id por materia.
  const allSchedules = (await request('/schedules', { token })).data as { id: string; subject: string; teacherId: string; labCode: string }[];
  for (const c of clases) {
    const teacherId = docenteIds.get(c.teacher);
    const match = allSchedules.find(s => s.subject === c.subject && s.teacherId === teacherId);
    if (match) scheduleIds.set(c.subject, match.id);
  }

  // ── 5. Estudiantes ficticios + inscripción por Enrollment ────────────────
  const firstNames = ['Alejandro', 'Sofía', 'Mateo', 'Valentina', 'Sebastián', 'Camila', 'Nicolás', 'Isabella', 'Daniel', 'Mariana', 'Lucas', 'Gabriela', 'Diego', 'Renata', 'Andrés', 'Carolina', 'Felipe', 'Daniela', 'Santiago', 'Paula'];
  const lastNames = ['Morales', 'Villarreal', 'González', 'López', 'Ramírez', 'Torres', 'Castillo', 'Mendoza', 'Paredes', 'Vega', 'Rivas', 'Silva', 'Ortega', 'Salazar', 'Quintero', 'Navarro', 'Espinoza', 'Roldán', 'Cedeño', 'Armijos'];
  const careers = ['Ingeniería en Tecnologías de la Información (TIC)'];

  // Distribución: cada materia recibe 3-4 estudiantes; se cubren las 6.
  const distribution: string[][] = [
    ['Programación en la Nube', 'Simulación y Realidad Virtual', 'Interacción Hombre Computadora', 'Computación Forense', 'Gestión de Calidad de Software', 'Legislación Informática'],
    ['Programación en la Nube', 'Interacción Hombre Computadora', 'Gestión de Calidad de Software'],
    ['Simulación y Realidad Virtual', 'Computación Forense', 'Legislación Informática'],
    ['Programación en la Nube', 'Legislación Informática'],
    ['Interacción Hombre Computadora', 'Simulación y Realidad Virtual'],
    ['Computación Forense', 'Gestión de Calidad de Software'],
  ];

  // Idempotencia: no volver a crear estudiantes ficticios ya existentes.
  const existingStudents = (await request('/students', { token })).data as { name: string; id: string }[];
  const existingNames = new Set(existingStudents.map(s => s.name.toLowerCase()));

  for (let i = 0; i < 20; i++) {
    const name = `${firstNames[i]} ${lastNames[i]}`;
    const initials = (firstNames[i][0] + lastNames[i][0]).toUpperCase();
    const career = careers[i % careers.length];
    const materias = distribution[i % distribution.length];

    if (existingNames.has(name.toLowerCase())) {
      continue; // ya existe: no duplicar
    }
    const res = await request('/students', {
      method: 'POST',
      token,
      body: {
        name,
        career,
        avatarInitials: initials,
        scheduleId: scheduleIds.get(materias[0]),
      },
    });
    if (res.status !== 201) {
      throw new Error(`Error creando estudiante ${name}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    const studentId = (res.data as { id: string }).id;
    report.estudiantesCreados.push(name);
    existingNames.add(name.toLowerCase());

    // Inscripción en las materias adicionales vía Enrollment.
    for (let m = 1; m < materias.length; m++) {
      const scheduleId = scheduleIds.get(materias[m]);
      if (!scheduleId) continue;
      const enr = await request('/enrollments', { method: 'POST', token, body: { scheduleId, studentId } });
      if (enr.status === 201) {
        report.inscripcionesCreadas.push(`${name} → ${materias[m]}`);
      } else if (enr.status === 409) {
        report.inscripcionesCreadas.push(`${name} → ${materias[m]} (ya inscrito)`);
      }
    }
  }

  // ── 6. Verificaciones de consistencia ────────────────────────────────────
  await verify(token);

  console.log('\n=== INFORME DE POBLAMIENTO ===');
  console.log(JSON.stringify(report, null, 2));
}

async function verify(token: string) {
  const schedules = (await request('/schedules', { token })).data as { id: string; subject: string; teacherId: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string; academicTerm?: string }[];
  const users = (await request('/users', { token })).data as { id: string; name: string }[];
  const labs = (await request('/labs', { token })).data as { code: string }[];
  const students = (await request('/students', { token })).data as { id: string; name: string }[];

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const teacherName = (id: string) => users.find(u => u.id === id)?.name || id;

  // Traslapes del mismo docente.
  for (const a of schedules) {
    for (const b of schedules) {
      if (a.id === b.id) continue;
      if (a.teacherId === b.teacherId && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime) {
        report.conflictos.push(`Traslape de docente: ${teacherName(a.teacherId)} ${a.subject} vs ${b.subject}`);
      }
    }
  }

  // Laboratorios ocupados simultáneamente.
  for (const a of schedules) {
    for (const b of schedules) {
      if (a.id === b.id) continue;
      if (a.labCode === b.labCode && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime) {
        report.conflictos.push(`Lab ocupado a la vez: ${a.labCode} ${a.subject} vs ${b.subject}`);
      }
    }
  }

  // Duplicados de clase.
  for (const a of schedules) {
    for (const b of schedules) {
      if (a.id >= b.id) continue;
      if (a.subject === b.subject && a.teacherId === b.teacherId && a.dayOfWeek === b.dayOfWeek && a.startTime === b.startTime) {
        report.conflictos.push(`Duplicado: ${a.subject} (${a.dayOfWeek} ${a.startTime})`);
      }
    }
  }

  console.log(`[Verify] docentes=${users.length} labs=${labs.length} clases=${schedules.length} estudiantes=${students.length}`);
  console.log(`[Verify] Schedules con academicTerm 2026-A: ${schedules.filter(s => s.academicTerm === '2026-A').length}`);
}

main().catch(e => { console.error('[Seed] ERROR:', e.message || e); process.exit(1); });
