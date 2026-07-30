import { connectDB } from '@/lib/db';
import { User, Student, AccessLog, Alert } from '@/lib/models';
import { hashPassword } from '@/lib/auth';

async function seedDatabase() {
  await connectDB();
  const userCount = await User.countDocuments();
  if (userCount > 0) return 'Database already has data';

  const studentHash = await hashPassword('estudiante123');
  const docenteHash = await hashPassword('docente123');
  const adminHash = await hashPassword('admin123');

  await User.insertMany([
    { email: 'docente@faceaccess.lab', passwordHash: docenteHash, name: 'Dr. Ismael González', role: 'docente', createdAt: new Date() },
    { email: 'admin@faceaccess.lab', passwordHash: adminHash, name: 'Ing. Alejandro Morales', role: 'docente', createdAt: new Date() },
    { email: 'ismael@faceaccess.lab', passwordHash: studentHash, name: 'Ismael González', role: 'estudiante', studentId: 'student-ismael', createdAt: new Date() },
    { email: 'alejandro@faceaccess.lab', passwordHash: studentHash, name: 'Alejandro Morales', role: 'estudiante', studentId: 'student-alejandro', createdAt: new Date() },
    { email: 'sofia@faceaccess.lab', passwordHash: studentHash, name: 'Sofia Villarreal', role: 'estudiante', studentId: 'student-sofia', createdAt: new Date() },
    { email: 'julian@faceaccess.lab', passwordHash: studentHash, name: 'Julian Rivas', role: 'estudiante', studentId: 'student-julian', createdAt: new Date() },
  ]);

  await Student.insertMany([
    { id: 'student-ismael', name: 'Ismael González', career: 'Ingeniería TI', lab: 'LAB-02', photoUrl: '/images/students/ismael-gonzalez.jpg', matchPercentage: 99.8, status: 'allowed', avatarInitials: 'IG', createdAt: new Date() },
    { id: 'student-alejandro', name: 'Alejandro Morales', career: 'Ingeniería de Sistemas', lab: 'LAB-02', photoUrl: '/images/students/alejandro-morales.jpg', matchPercentage: 98.4, status: 'allowed', avatarInitials: 'AM', createdAt: new Date() },
    { id: 'student-sofia', name: 'Sofia Villarreal', career: 'Ciencias de la Computación', lab: 'LAB-01', photoUrl: '/images/students/sofia-villarreal.jpg', matchPercentage: 94.1, status: 'allowed', avatarInitials: 'SV', createdAt: new Date() },
    { id: 'student-julian', name: 'Julian Rivas', career: 'Ingeniería en Telecomunicaciones', lab: 'LAB-02', photoUrl: '/images/students/julian-rivas.jpg', matchPercentage: 91.5, status: 'allowed', avatarInitials: 'JR', createdAt: new Date() },
    { id: 'student-unknown', name: 'Persona Desconocida', career: 'No Registrado / Alerta', lab: 'Acceso Denegado', photoUrl: '/images/students/persona-desconocida.jpg', matchPercentage: 22.8, status: 'denied', avatarInitials: '?', createdAt: new Date() },
  ]);

  await AccessLog.insertMany([
    { id: 'log-1', studentId: 'student-alejandro', studentName: 'Alejandro Morales', avatarInitials: 'AM', date: 'Oct 24, 2024', time: '14:22:10', result: 'Permitido', similarity: 98.4, kioskId: 'Kiosk-042', createdAt: new Date() },
    { id: 'log-2', studentId: 'student-sofia', studentName: 'Sofia Villarreal', avatarInitials: 'SV', date: 'Oct 24, 2024', time: '14:15:05', result: 'Permitido', similarity: 94.1, kioskId: 'Kiosk-042', createdAt: new Date() },
    { id: 'log-3', studentId: 'student-unknown', studentName: 'Persona Desconocida', avatarInitials: '?', date: 'Oct 24, 2024', time: '14:10:48', result: 'Denegado', similarity: 22.8, kioskId: 'Kiosk-042', createdAt: new Date() },
    { id: 'log-4', studentId: 'student-julian', studentName: 'Julian Rivas', avatarInitials: 'JR', date: 'Oct 24, 2024', time: '13:58:22', result: 'Permitido', similarity: 91.5, kioskId: 'Kiosk-042', createdAt: new Date() },
  ]);

  await Alert.insertMany([
    { id: 'alert-1', severity: 'critical', source: 'Kiosk-042', message: 'ALERTA_TERMICA_KIOSK_42: Temperatura del sensor excede 41°C.', timestamp: '2024-10-24T14:30:00Z', status: 'active', createdAt: new Date() },
    { id: 'alert-2', severity: 'warning', source: 'AWS CloudWatch', message: 'RETARDO_PING_AWS: Latencia promedio de 85ms.', timestamp: '2024-10-24T14:15:00Z', status: 'active', createdAt: new Date() },
    { id: 'alert-3', severity: 'info', source: 'Kiosk-042', message: 'CÁMARA_ESTATIC_OK: Cámara IMX415 lista y operativa.', timestamp: '2024-10-24T13:00:00Z', status: 'resolved', createdAt: new Date() },
    { id: 'alert-4', severity: 'warning', source: 'AWS Lambda', message: 'TIMEOUT_PARCIAL: Función verify-face excedió 2.8s.', timestamp: '2024-10-24T12:45:00Z', status: 'acknowledged', createdAt: new Date() },
    { id: 'alert-5', severity: 'critical', source: 'DynamoDB', message: 'PROVISIONED_THROUGHPUT_EXCEEDED: Pico de 4500 requests/segundo.', timestamp: '2024-10-23T18:20:00Z', status: 'resolved', createdAt: new Date() },
    { id: 'alert-6', severity: 'info', source: 'Sistema', message: 'ACTUALIZACIÓN_DISPONIBLE: Nueva versión firmware 2.4.1.', timestamp: '2024-10-23T10:00:00Z', status: 'active', createdAt: new Date() },
    { id: 'alert-7', severity: 'warning', source: 'Kiosk-041', message: 'LECTURA_FALLIDA: 5 intentos fallidos consecutivos.', timestamp: '2024-10-22T16:10:00Z', status: 'active', createdAt: new Date() },
    { id: 'alert-8', severity: 'critical', source: 'AWS SNS', message: 'NOTIFICACIÓN_RECHAZADA: Fallo al enviar alerta SMS.', timestamp: '2024-10-22T09:30:00Z', status: 'resolved', createdAt: new Date() },
  ]);

  return 'Database seeded successfully';
}

export async function GET() {
  try {
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST() {
  try {
    const result = await seedDatabase();
    return new Response(JSON.stringify({ ok: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
