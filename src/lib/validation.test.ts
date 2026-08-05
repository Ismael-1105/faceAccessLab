import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerSchema,
  studentCreateSchema,
  scheduleCreateSchema,
  attendanceCreateSchema,
  enrollmentCreateSchema,
} from '../../lib/validation.ts';

describe('zod: loginSchema', () => {
  it('acepta email + contraseña válidos', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rechaza email inválido, contraseña vacía o campos extra', () => {
    expect(loginSchema.safeParse({ email: 'no-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x', role: 'admin' }).success).toBe(false);
  });

  it('acepta mfaToken de 6 dígitos y rechaza otro', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x', mfaToken: '123456' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x', mfaToken: '123' }).success).toBe(false);
  });
});

describe('zod: registerSchema', () => {
  it('acepta un registro válido', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: '123456', name: 'Ana', role: 'docente' }).success).toBe(true);
  });

  it('rechaza contraseña corta, rol inválido o email mal formado', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: '123', name: 'Ana', role: 'docente' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.com', password: '123456', name: 'Ana', role: 'admin' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'nope', password: '123456', name: 'Ana', role: 'docente' }).success).toBe(false);
  });
});

describe('zod: studentCreateSchema', () => {
  const base = { name: 'Ana', career: 'TIC', avatarInitials: 'AN', status: 'allowed', biometricStatus: 'pending' };

  it('acepta una ficha mínima válida', () => {
    expect(studentCreateSchema.safeParse(base).success).toBe(true);
  });

  it('acepta photoUrl como clave S3 (no necesariamente URL)', () => {
    expect(studentCreateSchema.safeParse({ ...base, photoUrl: 'students/s1.jpg' }).success).toBe(true);
  });

  it('rechaza status inválido o campos desconocidos', () => {
    expect(studentCreateSchema.safeParse({ ...base, status: 'blocked' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ ...base, hacker: true }).success).toBe(false);
  });
});

describe('zod: scheduleCreateSchema', () => {
  const base = { subject: 'SO', teacherId: 't1', labCode: 'LAB-02', dayOfWeek: 1, startTime: '08:00', endTime: '10:00' };

  it('acepta un horario válido y rechaza fin <= inicio', () => {
    expect(scheduleCreateSchema.safeParse(base).success).toBe(true);
    expect(scheduleCreateSchema.safeParse({ ...base, endTime: '08:00' }).success).toBe(false);
    expect(scheduleCreateSchema.safeParse({ ...base, endTime: '07:00' }).success).toBe(false);
  });

  it('rechaza hora mal formada o día fuera de rango', () => {
    expect(scheduleCreateSchema.safeParse({ ...base, startTime: '25:00' }).success).toBe(false);
    expect(scheduleCreateSchema.safeParse({ ...base, dayOfWeek: 7 }).success).toBe(false);
  });
});

describe('zod: attendanceCreateSchema y enrollment', () => {
  it('acepta solo estados presente/ausente', () => {
    expect(attendanceCreateSchema.safeParse({ studentId: 's', scheduleId: 'c', status: 'presente' }).success).toBe(true);
    expect(attendanceCreateSchema.safeParse({ studentId: 's', scheduleId: 'c', status: 'ausente' }).success).toBe(true);
    expect(attendanceCreateSchema.safeParse({ studentId: 's', scheduleId: 'c', status: 'fuera_de_horario' }).success).toBe(false);
  });

  it('enrollment exige scheduleId y studentId', () => {
    expect(enrollmentCreateSchema.safeParse({ scheduleId: 'c', studentId: 's' }).success).toBe(true);
    expect(enrollmentCreateSchema.safeParse({ scheduleId: 'c' }).success).toBe(false);
  });
});
