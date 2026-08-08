/**
 * Diagnóstico de duplicados en Attendance. SOLO LECTURA.
 *
 * ISS-19 añade el índice único { studentId, scheduleId, date }. Si la colección
 * ya contiene duplicados de demostraciones anteriores, esa construcción falla, y
 * con `autoIndex` activo falla al inicializar el modelo, no solo al ejecutar
 * `ensure-indexes`. Este script responde a la única pregunta previa que importa:
 * cuántos duplicados hay.
 *
 * No escribe, no borra y no crea índices. Es seguro ejecutarlo contra cualquier
 * base, incluida la real. La limpieza es una decisión aparte y deliberada.
 *
 *   npx tsx scripts/check-attendance-duplicates.ts
 */
import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { connectDB } from '../lib/db.ts';
import { Attendance } from '../lib/models.ts';

interface DuplicateGroup {
  _id: { studentId: string; scheduleId: string; date: string };
  count: number;
  ids: string[];
}

async function main() {
  await connectDB();

  const total = await Attendance.countDocuments();

  const groups = await Attendance.aggregate<DuplicateGroup>([
    {
      $group: {
        _id: { studentId: '$studentId', scheduleId: '$scheduleId', date: '$date' },
        count: { $sum: 1 },
        ids: { $push: '$id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Documentos que sobran: cada grupo debería tener exactamente uno.
  const excess = groups.reduce((acc, g) => acc + (g.count - 1), 0);

  console.log('--- Diagnóstico de duplicados en Attendance (solo lectura) ---');
  console.log(`Documentos totales:            ${total}`);
  console.log(`Grupos {studentId, scheduleId, date} duplicados: ${groups.length}`);
  console.log(`Documentos sobrantes:          ${excess}`);

  if (groups.length === 0) {
    console.log('\nEl índice único se puede crear sin limpieza previa.');
  } else {
    console.log('\nEl índice único FALLARÁ hasta que se limpien estos grupos:');
    for (const g of groups.slice(0, 20)) {
      console.log(`  ${g._id.studentId} / ${g._id.scheduleId} / ${g._id.date}  ->  ${g.count} registros  [${g.ids.join(', ')}]`);
    }
    if (groups.length > 20) {
      console.log(`  ... y ${groups.length - 20} grupos más.`);
    }
    console.log('\nEste script NO limpia nada. La limpieza es una decisión aparte.');
  }

  await mongoose.disconnect();
}

main().catch(e => {
  console.error('[Duplicados] Error:', e);
  process.exit(1);
});
