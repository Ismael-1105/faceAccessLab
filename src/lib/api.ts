const API_BASE = '/api';

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('faceaccess_token', token);
  } else {
    localStorage.removeItem('faceaccess_token');
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
    request<{ token: string; mfaRequired?: boolean; user: { id: string; email: string; name: string; role: string; studentId?: string } }>('/auth/login', {
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

  createUser: (data: { email: string; password: string; name: string }) =>
    request<{ user: import('../types.ts').AdminUser }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, updates: { email?: string; password?: string; name?: string }) =>
    request<{ user: import('../types.ts').AdminUser }>('/users', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  deleteUser: (id: string) =>
    request<{ ok: boolean; message: string }>('/users', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
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

  getAuditLogs: () =>
    request<import('../types.ts').AuditLogEntry[]>('/audit'),

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

  createStudent: (student: Omit<import('../types.ts').Student, '_id'>) =>
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

  getLogs: async () => {
    const logs = await request<Array<import('../types.ts').AccessLog & { _id?: string }>>('/logs');
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
