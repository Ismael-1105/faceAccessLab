import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WarningOctagon, WarningCircle, Info, CheckCircle,
  Trash, Clock, ShieldCheck
} from '@phosphor-icons/react';
import type { Alert } from '../types.ts';

interface AlertsCenterProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

const SEVERITY_ORDER = ['critical', 'warning', 'info'] as const;

export default function AlertsCenter({ alerts, onAcknowledge, onResolve }: AlertsCenterProps) {
  const [activeFilter, setActiveFilter] = useState<'active' | 'acknowledged' | 'resolved'>('active');

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  const filtered = alerts
    .filter(a => a.status === activeFilter)
    .sort((a, b) => {
      const sa = SEVERITY_ORDER.indexOf(a.severity as typeof SEVERITY_ORDER[number]);
      const sb = SEVERITY_ORDER.indexOf(b.severity as typeof SEVERITY_ORDER[number]);
      if (sa !== sb) return sa - sb;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const severityIcon = (sev: Alert['severity']) => {
    switch (sev) {
      case 'critical': return <WarningOctagon className="w-4 h-4 text-red-500" weight="fill" />;
      case 'warning': return <WarningCircle className="w-4 h-4 text-amber-500" weight="fill" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" weight="fill" />;
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const TABS = [
    { key: 'active' as const, label: 'Activas', count: activeCount, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
    { key: 'acknowledged' as const, label: 'Reconocidas', count: acknowledgedCount, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
    { key: 'resolved' as const, label: 'Resueltas', count: resolvedCount, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
          Centro de Alertas
          {activeCount > 0 && (
            <span className="ml-2 text-label font-bold px-2 py-0.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 align-middle">
              {activeCount} activa{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Monitoreo de incidencias del ecosistema biométrico.</p>
      </div>

      {/* Tabs — reemplaza search + 2 selects (8 opciones → 3 tabs) */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === key
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-label ${activeFilter === key ? 'bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          <AnimatePresence>
            {filtered.map(alert => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                layout
                className={`group p-4 rounded-xl border text-xs transition-all ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/50'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50'
                    : 'bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">
                      {severityIcon(alert.severity)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 dark:text-white text-xs">{alert.source}</span>
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed break-words">{alert.message}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-zinc-400 dark:text-zinc-500">
                        <Clock className="w-3 h-3" weight="regular" />
                        <span className="text-label">{formatTimestamp(alert.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Actions: solo visibles en hover (progressive disclosure) */}
                  <div className="flex items-center gap-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {alert.status === 'active' && (
                      <button onClick={() => onAcknowledge(alert.id)}
                        className="p-2.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-all cursor-pointer"
                        title="Reconocer" aria-label="Reconocer alerta">
                        <CheckCircle className="w-4 h-4" weight="regular" />
                      </button>
                    )}
                    {(alert.status === 'active' || alert.status === 'acknowledged') && (
                      <button onClick={() => onResolve(alert.id)}
                        className="p-2.5 rounded-xl text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/30 transition-all cursor-pointer"
                        title="Resolver" aria-label="Resolver alerta">
                        <ShieldCheck className="w-4 h-4" weight="regular" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No hay alertas {activeFilter === 'active' ? 'activas' : activeFilter === 'acknowledged' ? 'reconocidas' : 'resueltas'}</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Todo en orden con el ecosistema biométrico.</p>
          </div>
        )}
      </div>
    </div>
  );
}

