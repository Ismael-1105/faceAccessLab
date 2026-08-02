import { connectDB } from '@/lib/db';
import { AccessLog } from '@/lib/models';
import { getAuthPayload } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = getAuthPayload(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (auth.role !== 'admin' && auth.role !== 'docente') {
    return new Response(JSON.stringify({ error: 'Acceso restringido' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await connectDB();
    const logs = await AccessLog.find().sort({ createdAt: -1 }).limit(2000);

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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
