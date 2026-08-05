import { describe, expect, it } from 'vitest';
import { generateToken } from '../../lib/auth.ts';
import {
  requireAuth,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireStudent,
  canManageSchedule,
  canManageStudent,
  canViewEvidence,
  canCloseIncident,
  UnauthorizedError,
  ForbiddenError,
} from '../../lib/rbac.ts';

function authed(role: 'admin' | 'docente' | 'estudiante', userId = 'u1') {
  const token = generateToken({ userId, email: 'e@x.com', role });
  return new Request('http://localhost/x', { headers: { Authorization: `Bearer ${token}` } });
}

const anon = new Request('http://localhost/x');

describe('rbac: require*', () => {
  it('requireAuth lanza UnauthorizedError sin token', () => {
    expect(() => requireAuth(anon)).toThrow(UnauthorizedError);
  });

  it('requireRole acepta el rol correcto y rechaza el resto', () => {
    const actor = requireRole(authed('admin'), ['admin']);
    expect(actor.role).toBe('admin');
    expect(() => requireRole(authed('estudiante'), ['admin', 'docente'])).toThrow(ForbiddenError);
    expect(() => requireRole(anon, ['admin'])).toThrow(UnauthorizedError);
  });

  it('requireAdmin / requireTeacher / requireStudent', () => {
    expect(requireAdmin(authed('admin')).role).toBe('admin');
    expect(requireTeacher(authed('docente')).role).toBe('docente');
    expect(requireTeacher(authed('admin')).role).toBe('admin');
    expect(() => requireAdmin(authed('docente'))).toThrow(ForbiddenError);
    expect(() => requireTeacher(authed('estudiante'))).toThrow(ForbiddenError);
    expect(requireStudent(authed('estudiante')).role).toBe('estudiante');
  });
});

describe('rbac: propiedad de recursos', () => {
  it('canManageSchedule: admin o docente propietario', () => {
    const admin = authed('admin');
    const owner = authed('docente', 't1');
    const other = authed('docente', 't2');

    expect(canManageSchedule(admin, 't1').role).toBe('admin');
    expect(canManageSchedule(owner, 't1').userId).toBe('t1');
    expect(() => canManageSchedule(other, 't1')).toThrow(ForbiddenError);
    expect(() => canManageSchedule(anon, 't1')).toThrow(UnauthorizedError);
  });

  it('canManageStudent: admin, o docente propietario del estudiante', () => {
    const admin = requireAuth(authed('admin'));
    const owner = requireAuth(authed('docente', 't1'));
    const other = requireAuth(authed('docente', 't2'));

    expect(canManageStudent(admin, 't1').role).toBe('admin');
    expect(canManageStudent(owner, 't1').userId).toBe('t1');
    expect(() => canManageStudent(other, 't1')).toThrow(ForbiddenError);
  });

  it('canViewEvidence: admin ve todo; docente solo lo propio', () => {
    const admin = requireAuth(authed('admin'));
    const doc = requireAuth(authed('docente'));
    expect(canViewEvidence(admin, false)).toBe(true);
    expect(canViewEvidence(doc, true)).toBe(true);
    expect(canViewEvidence(doc, false)).toBe(false);
  });

  it('canCloseIncident: solo admin', () => {
    const admin = requireAuth(authed('admin'));
    const doc = requireAuth(authed('docente'));
    expect(canCloseIncident(admin)).toBe(true);
    expect(canCloseIncident(doc)).toBe(false);
  });
});
