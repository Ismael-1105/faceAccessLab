import type { TokenPayload } from './auth.ts';
import { DenialEvidence, Enrollment, Schedule, Student } from './models.ts';
import { getExistingStudentIds } from './scheduling.ts';

/** Limita las URLs firmadas a los dos namespaces administrados por la app. */
export function isManagedPhotoKey(key: string): boolean {
  return /^(students|evidence)\/[A-Za-z0-9._\-/]+$/.test(key) && !key.includes('..');
}

/** Admin ve todo; docente únicamente fotos de estudiantes de sus clases. */
export async function canReadPhoto(actor: TokenPayload, key: string): Promise<boolean> {
  if (!isManagedPhotoKey(key)) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'docente') return false;

  const schedules = await Schedule.find({ teacherId: actor.userId }).select('id');
  const scheduleIds = schedules.map(schedule => schedule.id);
  if (scheduleIds.length === 0) return false;

  const enrollments = await Enrollment.find({
    scheduleId: { $in: scheduleIds },
    active: true,
  }).select('studentId');
  const studentIds = new Set(await getExistingStudentIds(enrollments.map(enrollment => enrollment.studentId)));
  if (studentIds.size === 0) return false;

  const studentPhoto = await Student.findOne({ photoKey: key }).select('id');
  if (studentPhoto) return studentIds.has(studentPhoto.id);

  const evidence = await DenialEvidence.findOne({ photoKey: key }).select('studentId');
  return !!evidence?.studentId && studentIds.has(evidence.studentId);
}
