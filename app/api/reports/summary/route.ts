import { connectDB } from '@/lib/db';
import { AccessLog, Schedule } from '@/lib/models';
import { requireTeacher } from '@/lib/rbac';

/**
 * GET /api/reports/summary
 * Reporte de accesos. Un docente solo ve los accesos de sus clases;
 * el administrador ve el global.
 */
export async function GET(req: Request) {
  try {
    const actor = requireTeacher(req);

    await connectDB();
    const filter: Record<string, unknown> = {};

    if (actor.role === 'docente') {
      // Un docente solo ve los accesos de sus clases (nunca confiar en el frontend).
      const schedules = await Schedule.find({ teacherId: actor.userId }).select('id');
      const scheduleIds = schedules.map(s => s.id);
      if (scheduleIds.length === 0) {
        return new Response(JSON.stringify({ total: 0, permitidos: 0, denegados: 0, rate: '0', avgSimilarity: '0', topStudents: [], topLabs: [] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      filter.scheduleId = { $in: scheduleIds };
    }

    const logs = await AccessLog.find(filter).sort({ createdAt: -1 }).limit(2000);

    const total = logs.length;
    const permitidos = logs.filter(l => l.result === 'Permitido').length;
    const denegados = total - permitidos;
    const avgSimilarity = total > 0
      ? (logs.reduce((s, l) => s + l.similarity, 0) / total).toFixed(1)
      : '0';
    const rate = total > 0 ? ((permitidos / total) * 100).toFixed(1) : '0';

    const byStudent = new Map<string, number>();
    const byLab = new Map<string, number>();
    logs.forEach(l => {
      byStudent.set(l.studentName, (byStudent.get(l.studentName) || 0) + 1);
      byLab.set(l.lab || l.kioskId || 'Sin lab', (byLab.get(l.lab || l.kioskId || 'Sin lab') || 0) + 1);
    });
    const topStudents = [...byStudent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLabs = [...byLab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const lines = [
      '=============================================',
      '  REPORTE DE ACCESOS - FACEACCESS LAB',
      '=============================================',
      `  Generado: ${new Date().toLocaleString('es-EC')}`,
      `  Alcance: ${actor.role === 'docente' ? 'Solo mis clases' : 'Global'}`,
      '',
      'RESUMEN',
      '---------------------------------------------',
      `  Total de accesos:     ${total}`,
      `  Permitidos:           ${permitidos}`,
      `  Denegados:            ${denegados}`,
      `  Tasa de autorización: ${rate}%`,
      `  Similitud promedio:   ${avgSimilarity}%`,
      '',
      'TOP 5 ALUMNOS CON MÁS ACCESOS',
      '---------------------------------------------',
      ...topStudents.map(([name, n]) => `  ${name}: ${n} accesos`),
      '',
      'LABORATORIOS MÁS UTILIZADOS',
      '---------------------------------------------',
      ...topLabs.map(([lab, n]) => `  ${lab}: ${n} accesos`),
      '',
      '=============================================',
      '  FACEACCESS LAB - UIDE',
      '=============================================',
    ];

    return new Response(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-faceaccess-${new Date().toISOString().slice(0, 10)}.txt"`,
      },
    });
  } catch (e) {
    const status = e instanceof Error && 'status' in e ? (e as { status: number }).status : 500;
    const message = status === 401 ? 'No autorizado' : status === 403 ? 'Acceso restringido' : (e instanceof Error ? e.message : 'Error');
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }
}
