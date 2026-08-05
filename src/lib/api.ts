const API_BASE = '/api';

let authToken: string | null = null;

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h (coincide con JWT)

function writeCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('faceaccess_token', token);
    writeCookie(token);
  } else {
    localStorage.removeItem('faceaccess_token');
    clearCookie();
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  const stored = localStorage.getItem('faceaccess_token');
  if (stored) {
    authToken = stored;
    return stored;
  }
  return null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de conexión' }));
    throw new Error(body.error || `Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string, mfaToken?: string) =>
    request<{ token: string; mfaRequired?: boolean; user: { id: string; email: string; name: string; role: string; studentId?: string; labCode?: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaToken }),
    }),

  setupMfa: () =>
    request<{ ok: boolean; secret: string; qrLabel: string }>('/auth/mfa', {
      method: 'POST',
      body: JSON.stringify({ action: 'setup' }),
    }),

  enableMfa: (token: string) =>
    request<{ ok: boolean; message: string }>('/auth/mfa', {
      method: 'POST',
      body: JSON.stringify({ action: 'verify', token }),
    }),

  disableMfa: (token: string) =>
    request<{ ok: boolean; message: string }>('/auth/mfa', {
      method: 'POST',
      body: JSON.stringify({ action: 'disable', token }),
    }),

  register: (data: { email: string; password: string; name: string; role: string }) =>
    request<{ user: { id: string; email: string; name: string; role: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUsers: () =>
    request<import('../types.ts').AdminUser[]>('/users'),

  createUser: (data: { email: string; password: string; name: string; labCode?: string }) =>
    request<{ user: import('../types.ts').AdminUser }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, updates: { email?: string; password?: string; name?: string; labCode?: string }) =>
    request<{ user: import('../types.ts').AdminUser }>('/users', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  deleteUser: (id: string) =>
    request<{ ok: boolean; message: string }>('/users', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),

  updateUserStatus: (id: string, status: 'active' | 'inactive' | 'suspended') =>
    request<{ user: import('../types.ts').AdminUser }>('/users', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    }),

  getLabs: () =>
    request<import('../types.ts').Lab[]>('/labs'),

  createLab: (data: { name: string; code: string; description?: string; active?: boolean }) =>
    request<{ lab: import('../types.ts').Lab }>('/labs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLab: (id: string, updates: { name?: string; code?: string; description?: string; active?: boolean }) =>
    request<{ lab: import('../types.ts').Lab }>('/labs', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  deleteLab: (id: string) =>
    request<{ ok: boolean; message: string }>('/labs', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),

  getAuditLogs: (page = 1, pageSize = 10, search = '') =>
    request<{ logs: import('../types.ts').AuditLogEntry[]; total: number; page: number; pageSize: number; totalPages: number; hasMore: boolean }>(
      `/audit?page=${page}&limit=${pageSize}${search ? `&q=${encodeURIComponent(search)}` : ''}`,
    ),

  getSchedules: () =>
    request<import('../types.ts').Schedule[]>('/schedules'),

  createSchedule: (data: { subject: string; teacherId: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string; active?: boolean; parallel?: string; campus?: string; academicTerm?: string; deliveryMode?: 'presencial' | 'virtual'; requiresPhysicalAccess?: boolean; activeKiosk?: boolean }) =>
    request<{ schedule: import('../types.ts').Schedule }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSchedule: (id: string, updates: Partial<{ subject: string; teacherId: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string; active: boolean; status: import('../types.ts').Schedule['status']; parallel: string; campus: string; academicTerm: string; deliveryMode: 'presencial' | 'virtual'; requiresPhysicalAccess: boolean; activeKiosk: boolean }>) =>
    request<{ schedule: import('../types.ts').Schedule }>('/schedules', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  getAcademicTerms: () =>
    request<import('../types.ts').AcademicTerm[]>('/terms'),

  createAcademicTerm: (data: { code: string; name: string; startDate?: string; endDate?: string; isActive?: boolean }) =>
    request<import('../types.ts').AcademicTerm>('/terms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSchedule: (id: string) =>
    request<{ ok: boolean; message: string }>('/schedules', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),

  getEnrollments: () =>
    request<import('../types.ts').Enrollment[]>('/enrollments'),

  createEnrollment: (data: { scheduleId: string; studentId: string }) =>
    request<{ enrollment: import('../types.ts').Enrollment }>('/enrollments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteEnrollment: (id: string) =>
    request<{ ok: boolean; message: string }>('/enrollments', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),

  getAttendance: () =>
    request<import('../types.ts').Attendance[]>('/attendance'),

  createAttendance: (data: { studentId: string; scheduleId: string; subject?: string; labCode?: string; teacherId?: string; status: import('../types.ts').AttendanceStatus }) =>
    request<import('../types.ts').Attendance>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLogsFiltered: async (filters: Record<string, string>) => {
    const qs = new URLSearchParams(filters).toString();
    const data = await request<Array<import('../types.ts').AccessLog & { _id?: string }> | { logs: Array<import('../types.ts').AccessLog & { _id?: string }>; nextCursor: string | null; hasMore: boolean }>(`/logs${qs ? `?${qs}` : ''}`);
    const logs = Array.isArray(data) ? data : data.logs;
    return logs.map(l => ({ ...l, id: l.id || String(l._id || '') }));
  },

  getAttendanceReport: () =>
    request<import('../types.ts').AttendanceReport>('/reports/attendance'),

  getLabDashboard: (code: string) =>
    request<import('../types.ts').LabDashboard>(`/labs/${encodeURIComponent(code)}/dashboard`),

  getDashboard: () =>
    request<import('../types.ts').AcademicDashboard>('/dashboard'),

  downloadAttendanceReport: async (format: 'excel' | 'pdf') => {
    const res = await fetch(`${API_BASE}/reports/attendance/export?format=${format}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Error al generar reporte' }));
      throw new Error(body.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const ext = format === 'excel' ? 'csv' : 'html';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  logout: () =>
    request<{ ok: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getEvidence: () =>
    request<import('../types.ts').DenialEvidence[]>('/evidence'),

  getEvidencePhotoUrl: (key: string) =>
    request<{ url: string }>(`/evidence/photo?key=${encodeURIComponent(key)}`),

  getIncidents: () =>
    request<import('../types.ts').Incident[]>('/incidents'),

  closeIncident: (id: string) =>
    request<{ ok: boolean; incident: import('../types.ts').Incident }>('/incidents', {
      method: 'PUT',
      body: JSON.stringify({ id, status: 'closed' }),
    }),

  getHealth: () =>
    request<import('../types.ts').SystemHealth>('/health'),

  downloadReport: async () => {
    const res = await fetch(`${API_BASE}/reports/summary`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Error al generar reporte' }));
      throw new Error(body.error || `Error ${res.status}`);
    }
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-faceaccess-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getStudents: () =>
    request<import('../types.ts').Student[]>('/students'),

  createStudent: (student: Partial<import('../types.ts').Student> & { name: string; career: string; avatarInitials: string; scheduleId?: string }) =>
    request<import('../types.ts').Student>('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    }),

  updateStudent: (id: string, updates: Record<string, unknown>) =>
    request<import('../types.ts').Student>('/students', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  toggleStudent: (id: string) =>
    request<import('../types.ts').Student>('/students/toggle', {
      method: 'PUT',
      body: JSON.stringify({ id }),
    }),

  registerBiometric: (data: { studentId: string; imageBase64: string }) =>
    request<{ ok: boolean; message: string; student: import('../types.ts').Student }>('/rekognition/register-biometric', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLogs: async () => {
    const data = await request<Array<import('../types.ts').AccessLog & { _id?: string }> | { logs: Array<import('../types.ts').AccessLog & { _id?: string }>; nextCursor: string | null; hasMore: boolean }>('/logs?limit=500');
    const logs = Array.isArray(data) ? data : data.logs;
    return logs.map(log => ({ ...log, id: log.id || String(log._id || '') }));
  },

  createLog: (log: Omit<import('../types.ts').AccessLog, '_id'>) =>
    request<import('../types.ts').AccessLog>('/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  getStats: () =>
    request<{ registered: number; accessesToday: number; deniedToday: number; alertsActive: number }>('/stats'),

  getAlerts: async () => {
    const alerts = await request<Array<import('../types.ts').Alert & { _id?: string }>>('/alerts');
    return alerts.map(alert => ({ ...alert, id: alert.id || String(alert._id || '') }));
  },

  updateAlert: (id: string, status: string) =>
    request<import('../types.ts').Alert>('/alerts', {
      method: 'PUT',
      body: JSON.stringify({ id, status }),
    }),

  getStudentsPublic: () =>
    request<import('../types.ts').Student[]>('/kiosk'),

  createLogPublic: (log: Omit<import('../types.ts').AccessLog, '_id'>) =>
    request<import('../types.ts').AccessLog>('/kiosk', {
      method: 'POST',
      body: JSON.stringify(log),
    }),
};
