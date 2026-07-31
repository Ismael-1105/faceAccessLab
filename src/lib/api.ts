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
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string; role: string; studentId?: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; name: string; role: string }) =>
    request<{ user: { id: string; email: string; name: string; role: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
