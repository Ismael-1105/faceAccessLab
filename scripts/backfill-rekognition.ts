import 'dotenv/config';
import { connectDB } from '../lib/db.ts';
import { Student } from '../lib/models.ts';
import { listFaces } from '../lib/rekognition.ts';

async function backfill() {
  console.log('[Backfill] Connecting...');
  await connectDB();

  const faces = await listFaces();
  console.log(`[Backfill] Rostros en Rekognition: ${faces.length}`);

  for (const face of faces) {
    const existing = await Student.findOne({ id: face.studentId });

    if (!existing) {
      console.log(`[Backfill] Buscando estudiante por photoUrl que contenga "${face.studentId}"...`);
      const byPhoto = await Student.findOne({ photoUrl: { $regex: face.studentId } });

      if (byPhoto) {
        byPhoto.id = face.studentId;
        byPhoto.faceEmbeddingId = face.faceId;
        await byPhoto.save();
        console.log(`[Backfill] → Vinculado ${byPhoto.name} (${face.studentId}) con faceId ${face.faceId}`);
      } else {
        console.log(`[Backfill] ✗ No se encontró estudiante para el rostro ${face.studentId}`);
      }
      continue;
    }

    if (!existing.faceEmbeddingId) {
      existing.faceEmbeddingId = face.faceId;
      await existing.save();
      console.log(`[Backfill] → Actualizado faceEmbeddingId de ${existing.name}`);
    } else {
      console.log(`[Backfill] → Ya vinculado: ${existing.name} (${face.studentId})`);
    }
  }

  console.log('[Backfill] Done.');
  process.exit(0);
}

backfill().catch((e) => {
  console.error('[Backfill] Error:', e);
  process.exit(1);
});
