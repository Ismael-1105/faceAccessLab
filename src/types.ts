/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Career =
  | 'Administración de Empresas'
  | 'Negocios Internacionales'
  | 'Marketing'
  | 'Psicología Clínica'
  | 'Derecho'
  | 'Ingeniería en Sistemas de Información'
  | 'Arquitectura';

export interface CareerInfo {
  value: Career;
  degree: string;
  duration: string;
  modality: string;
  accreditation?: string;
}

export const CAREERS: CareerInfo[] = [
  {
    value: 'Administración de Empresas',
    degree: 'Licenciatura',
    duration: '2 años',
    modality: 'Presencial y a distancia',
  },
  {
    value: 'Negocios Internacionales',
    degree: 'Licenciatura',
    duration: '5 años',
    modality: 'Presencial y a distancia',
    accreditation: 'ACBSP · Segunda titulación 3+1',
  },
  {
    value: 'Marketing',
    degree: 'Licenciatura',
    duration: '8 semestres',
    modality: 'Presencial',
  },
  {
    value: 'Psicología Clínica',
    degree: 'Licenciatura',
    duration: '8 semestres',
    modality: 'Presencial',
  },
  {
    value: 'Derecho',
    degree: 'Abogado/a',
    duration: '8 semestres',
    modality: 'Presencial',
  },
  {
    value: 'Ingeniería en Sistemas de Información',
    degree: 'Ingeniero/a',
    duration: '8 semestres',
    modality: 'Presencial',
  },
  {
    value: 'Arquitectura',
    degree: 'Arquitecto/a',
    duration: '9 semestres',
    modality: 'Presencial',
  },
];

export interface Student {
  id: string;
  name: string;
  lastName?: string;
  documentId?: string;
  email?: string;
  phone?: string;
  career: string;
  lab: string;
  labs?: string[];
  photoUrl: string;
  photoKey?: string;
  faceEmbeddingId?: string;
  matchPercentage: number;
  status: 'allowed' | 'denied';
  avatarInitials: string;
}

export interface AccessLog {
  id: string;
  studentId: string;
  studentName: string;
  avatarInitials: string;
  date: string;
  time: string;
  result: 'Permitido' | 'Denegado';
  similarity: number;
}

export interface CloudService {
  id: string;
  name: string;
  iconName: string;
  tag: string;
  description: string;
  actionLabel: string;
  status: 'operational' | 'busy' | 'alert';
}

export type AppView = 'home' | 'demo' | 'admin' | 'architecture';

export type UserRole = 'admin' | 'docente' | 'estudiante';

export interface AuthUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  studentId?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'docente';
  createdAt: string;
}

export interface Lab {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}
