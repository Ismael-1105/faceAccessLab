import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AccessLog, AuthUser } from '../types.ts';
import { INITIAL_STUDENTS, INITIAL_LOGS, DAILY_STATS } from '../data.ts';
import ErrorBoundary from '../components/ErrorBoundary.tsx';

export type Theme = 'light' | 'dark';

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  user: AuthUser | null;
  handleLogin: (authUser: AuthUser) => void;
  handleLogout: () => void;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  logs: AccessLog[];
  setLogs: React.Dispatch<React.SetStateAction<AccessLog[]>>;
  stats: { registered: number; accessesToday: number; deniedToday: number; alertsActive: number };
  setStats: React.Dispatch<React.SetStateAction<{ registered: number; accessesToday: number; deniedToday: number; alertsActive: number }>>;
  handleToggleStudent: (id: string) => void;
  handleAddStudent: (newStudent: Student) => void;
  handleAddLog: (newLog: AccessLog) => void;
  handleIncrementStats: (isAllowed: boolean) => void;
  handleClearAlerts: () => void;
  handleClearLogs: () => void;
  hasCameraPermission: boolean;
  setHasCameraPermission: React.Dispatch<React.SetStateAction<boolean>>;
  showPermissionGate: boolean;
  setShowPermissionGate: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.classList.toggle('light', next === 'light');
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, []);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [logs, setLogs] = useState<AccessLog[]>(INITIAL_LOGS);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [showPermissionGate, setShowPermissionGate] = useState(false);

  const [stats, setStats] = useState({
    registered: DAILY_STATS.registered,
    accessesToday: DAILY_STATS.accessesToday,
    deniedToday: DAILY_STATS.deniedToday,
    alertsActive: DAILY_STATS.alertsActive
  });

  const handleLogin = (authUser: AuthUser) => setUser(authUser);
  const handleLogout = () => setUser(null);

  const handleToggleStudent = (id: string) => {
    setStudents(prev =>
      prev.map(student => {
        if (student.id === id) {
          return { ...student, status: student.status === 'allowed' ? 'denied' : 'allowed' as const };
        }
        return student;
      })
    );
  };

  const handleAddStudent = (newStudent: Student) => {
    setStudents(prev => [newStudent, ...prev]);
    setStats(prev => ({ ...prev, registered: prev.registered + 1 }));
  };

  const handleAddLog = (newLog: AccessLog) => {
    setLogs(prev => [newLog, ...prev]);
  };

  const handleIncrementStats = (isAllowed: boolean) => {
    setStats(prev => ({
      ...prev,
      accessesToday: prev.accessesToday + 1,
      deniedToday: isAllowed ? prev.deniedToday : prev.deniedToday + 1,
      alertsActive: isAllowed ? prev.alertsActive : prev.alertsActive + 1
    }));
  };

  const handleClearAlerts = () => {
    setStats(prev => ({ ...prev, alertsActive: 0 }));
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme, user, handleLogin, handleLogout,
      students, setStudents, logs, setLogs,
      stats, setStats,
      handleToggleStudent, handleAddStudent, handleAddLog, handleIncrementStats,
      handleClearAlerts, handleClearLogs,
      hasCameraPermission, setHasCameraPermission,
      showPermissionGate, setShowPermissionGate,
    }}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AppContext.Provider>
  );
}
