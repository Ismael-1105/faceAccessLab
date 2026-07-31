'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AccessLog, AuthUser, Alert } from '../types.ts';
import { INITIAL_STUDENTS, DAILY_STATS } from '../data.ts';
import { api, getToken, setToken } from '../lib/api.ts';
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
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  stats: { registered: number; accessesToday: number; deniedToday: number; alertsActive: number };
  setStats: React.Dispatch<React.SetStateAction<{ registered: number; accessesToday: number; deniedToday: number; alertsActive: number }>>;
  connectionStatus: 'checking' | 'online' | 'offline';
  setConnectionStatus: React.Dispatch<React.SetStateAction<'checking' | 'online' | 'offline'>>;
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
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const initial = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
  }, []);

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
  }, [theme]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [showPermissionGate, setShowPermissionGate] = useState(false);

  const [stats, setStats] = useState({
    registered: DAILY_STATS.registered,
    accessesToday: DAILY_STATS.accessesToday,
    deniedToday: DAILY_STATS.deniedToday,
    alertsActive: DAILY_STATS.alertsActive
  });
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.userId,
          email: payload.email,
          password: '',
          name: '',
          role: payload.role,
          studentId: payload.studentId,
        });
      } catch {
        setToken(null);
      }
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'docente') {
      Promise.all([
        api.getStudents().catch(() => null),
        api.getLogs().catch(() => null),
        api.getStats().catch(() => null),
        api.getAlerts().catch(() => null),
      ]).then(([studentsData, logsData, statsData, alertsData]) => {
        const anyLive = studentsData !== null || logsData !== null || statsData !== null || alertsData !== null;
        setConnectionStatus(anyLive ? 'online' : 'offline');
        if (studentsData) setStudents(studentsData);
        if (logsData) setLogs(logsData);
        if (statsData) setStats(statsData);
        if (alertsData) setAlerts(alertsData);
      });

      const interval = setInterval(() => {
        api.getAlerts()
          .then(data => {
            if (data) {
              setAlerts(data);
              setConnectionStatus('online');
            }
          })
          .catch(() => setConnectionStatus(prev => prev === 'online' ? prev : 'offline'));
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogin = (authUser: AuthUser) => setUser(authUser);
  const handleLogout = () => {
    setUser(null);
    setToken(null);
  };

  const handleToggleStudent = async (id: string) => {
    const prevStudents = students;
    setStudents(prev =>
      prev.map(student =>
        student.id === id
          ? { ...student, status: student.status === 'allowed' ? 'denied' as const : 'allowed' as const }
          : student
      )
    );
    try {
      await api.toggleStudent(id);
    } catch {
      setStudents(prevStudents);
    }
  };

  const handleAddStudent = async (newStudent: Student) => {
    try {
      const created = await api.createStudent(newStudent);
      setStudents(prev => [created, ...prev]);
      setStats(prev => ({ ...prev, registered: prev.registered + 1 }));
    } catch {
      setStudents(prev => [newStudent, ...prev]);
      setStats(prev => ({ ...prev, registered: prev.registered + 1 }));
    }
  };

  const handleAddLog = async (newLog: AccessLog) => {
    setLogs(prev => [newLog, ...prev]);
    try {
      await api.createLogPublic(newLog);
    } catch (e) { console.error('[Log] Error al guardar acceso:', e); }
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
    setAlerts([]);
    setStats(prev => ({ ...prev, alertsActive: 0 }));
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme, user, handleLogin, handleLogout,
      students, setStudents, logs, setLogs, alerts, setAlerts,
      stats, setStats, connectionStatus, setConnectionStatus,
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
