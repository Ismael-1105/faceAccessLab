import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Student, AccessLog, AuthUser, Alert } from '../src/types.ts';
import { INITIAL_STUDENTS, INITIAL_LOGS } from '../src/data.ts';
import { useApp } from '../src/context/AppContext.tsx';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/docente',
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
}));

vi.mock('../src/context/AppContext.tsx', () => ({
  useApp: () => contextValue,
  AppProvider: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

function mockContextValue() {
  return {
    theme: 'light' as const,
    toggleTheme: vi.fn(),
    user: { id: 'doc-1', email: 'docente@faceaccess.lab', password: '', name: 'Dr. Test', role: 'docente' as const },
    sessionReady: true,
    handleLogin: vi.fn(),
    handleLogout: vi.fn(),
    students: INITIAL_STUDENTS as Student[],
    setStudents: vi.fn(),
    logs: INITIAL_LOGS as AccessLog[],
    setLogs: vi.fn(),
    alerts: [] as Alert[],
    setAlerts: vi.fn(),
    stats: { registered: 324, accessesToday: 128, deniedToday: 12, alertsActive: 0 },
    setStats: vi.fn(),
    handleToggleStudent: vi.fn(),
    handleAddStudent: vi.fn(),
    handleAddLog: vi.fn(),
    handleIncrementStats: vi.fn(),
    handleClearAlerts: vi.fn(),
    handleClearLogs: vi.fn(),
    hasCameraPermission: false,
    setHasCameraPermission: vi.fn(),
    showPermissionGate: false,
    setShowPermissionGate: vi.fn(),
  };
}

let contextValue = mockContextValue();

beforeEach(() => {
  contextValue = mockContextValue();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function captureKeyWarnings(component: React.ReactElement): string[] {
  const warnings: string[] = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg.includes('key')) warnings.push(msg);
  };
  console.warn = (...args: unknown[]) => {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg.includes('key')) warnings.push(msg);
  };
  try {
    renderToStaticMarkup(component);
  } catch (e) {
    console.error = origError;
    console.warn = origWarn;
    throw e;
  }
  console.error = origError;
  console.warn = origWarn;
  return warnings;
}

describe('Key audit — sanity check', () => {
  it('detecta listas sin key (valida el harness)', () => {
    const Broken = () => (
      <div>
        {[1, 2, 3].map(n => (
          <span>{n}</span>
        ))}
      </div>
    );
    const warnings = captureKeyWarnings(React.createElement(Broken));
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('Key audit — causa raíz (datos API con _id sin id)', () => {
  const rawApiLogs = [
    { _id: 'abc123', studentId: 'student-1', studentName: 'A', avatarInitials: 'A', date: 'd', time: 't', result: 'Permitido' as const, similarity: 98.4 },
    { _id: 'def456', studentId: 'student-2', studentName: 'B', avatarInitials: 'B', date: 'd', time: 't', result: 'Denegado' as const, similarity: 22.8 },
  ];

  it('AdminView reproduce el warning con logs sin id', async () => {
    contextValue = { ...mockContextValue(), logs: rawApiLogs as unknown as AccessLog[] };
    const AdminView = (await import('../src/components/AdminView.tsx')).default;
    const warnings = captureKeyWarnings(React.createElement(AdminView));
    expect(warnings.length).toBeGreaterThan(0);
  }, 15000);

  it('api.getLogs normaliza _id → id (el fix elimina el warning)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(rawApiLogs),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('../src/lib/api.ts');
    const logs = await api.getLogs();
    expect(logs[0].id).toBe('abc123');
    expect(logs[1].id).toBe('def456');
  });
});

describe('Key audit — AdminView', () => {
  it('AdminView no debe emitir warnings de key', async () => {
    const AdminView = (await import('../src/components/AdminView.tsx')).default;
    const warnings = captureKeyWarnings(React.createElement(AdminView));
    expect(warnings).toEqual([]);
  }, 15000);
});

describe('Key audit — hijos de AdminView', () => {
  it('EnrollmentView', async () => {
    const EnrollmentView = (await import('../src/components/EnrollmentView.tsx')).default;
    const warnings = captureKeyWarnings(
      React.createElement(EnrollmentView, {
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    expect(warnings).toEqual([]);
  });

  it('StudentDetailView', async () => {
    const StudentDetailView = (await import('../src/components/StudentDetailView.tsx')).default;
    const warnings = captureKeyWarnings(
      React.createElement(StudentDetailView, {
        student: INITIAL_STUDENTS[0],
        logs: INITIAL_LOGS,
        onToggleStatus: vi.fn(),
        onBack: vi.fn(),
      })
    );
    expect(warnings).toEqual([]);
  });

  it('AlertsCenter', async () => {
    const testAlerts: Alert[] = [
      { id: 't1', severity: 'critical', source: 'Kiosk-042', message: 'Alerta crítica de prueba', timestamp: '2026-01-01T00:00:00Z', status: 'active' },
      { id: 't2', severity: 'warning', source: 'AWS CloudWatch', message: 'Alerta de advertencia de prueba', timestamp: '2026-01-01T00:01:00Z', status: 'acknowledged' },
      { id: 't3', severity: 'info', source: 'Sistema', message: 'Alerta informativa de prueba', timestamp: '2026-01-01T00:02:00Z', status: 'resolved' },
    ];
    const AlertsCenter = (await import('../src/components/AlertsCenter.tsx')).default;
    const warnings = captureKeyWarnings(
      React.createElement(AlertsCenter, {
        alerts: testAlerts,
        onAcknowledge: vi.fn(),
        onResolve: vi.fn(),
      })
    );
    expect(warnings).toEqual([]);
  });

  it('ReportsView', async () => {
    const ReportsView = (await import('../src/components/ReportsView.tsx')).default;
    const warnings = captureKeyWarnings(
      React.createElement(ReportsView, { logs: INITIAL_LOGS })
    );
    expect(warnings).toEqual([]);
  });
});

describe('Key audit — resto del proyecto', () => {
  it('ArchitectureView', async () => {
    const ArchitectureView = (await import('../src/components/ArchitectureView.tsx')).default;
    const warnings = captureKeyWarnings(React.createElement(ArchitectureView));
    expect(warnings).toEqual([]);
  });

  it('HomeView', async () => {
    const HomeView = (await import('../src/components/HomeView.tsx')).default;
    const warnings = captureKeyWarnings(React.createElement(HomeView));
    expect(warnings).toEqual([]);
  });

  it('DemoView', async () => {
    const DemoView = (await import('../src/components/DemoView.tsx')).default;
    const warnings = captureKeyWarnings(React.createElement(DemoView));
    expect(warnings).toEqual([]);
  });

  it('KioskStepper', async () => {
    const KioskStepper = (await import('../src/components/kiosk/KioskStepper.tsx')).default;
    const warnings = captureKeyWarnings(
      React.createElement(KioskStepper, {
        flowState: 'scanning',
        activeStage: 'compare',
        statusMessage: 'Comparando registros',
        statusHint: 'Buscando tu rostro en el índice biométrico',
        isSuccess: false,
        denialReason: null,
        scannedStudent: null,
        confidence: 0,
        resetCountdown: 0,
        consecutiveDenials: 0,
        onPrintReceipt: vi.fn(),
      })
    );
    expect(warnings).toEqual([]);
  });
});
