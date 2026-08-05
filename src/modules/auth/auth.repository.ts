/**
 * Repositorio del módulo de autenticación: única capa que toca persistencia.
 * Los modelos y el pool de conexión viven en lib/ (infraestructura legada);
 * este módulo los aísla del service.
 */
import { User } from '@/lib/models';
import { connectDB } from '@/lib/db';

export async function findUserByEmail(email: string) {
  await connectDB();
  return User.findOne({ email: email.toLowerCase() });
}

export async function findUserById(id: string) {
  await connectDB();
  return User.findById(id);
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  role: 'docente' | 'estudiante';
}) {
  await connectDB();
  return User.create({ email: data.email.toLowerCase(), passwordHash: data.passwordHash, name: data.name, role: data.role });
}
