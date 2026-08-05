/**
 * Tipos del módulo de autenticación (Fase 5).
 */
import type { TokenPayload } from '@/lib/auth';

export type { TokenPayload };

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  studentId?: string;
  labCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  mfaToken?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: 'docente' | 'estudiante';
}

/** Resultado plano: la ruta lo convierte en Response con sendJson. */
export interface AuthResult {
  status: number;
  body: unknown;
  cookies?: string[];
}
