'use client';

import React, { useEffect, useState } from 'react';
import { ShieldWarning, CircleNotch, CheckCircle, X, WarningOctagon, Clock } from '@phosphor-icons/react';
import type { Incident } from '../types.ts';
import { api } from '../lib/api.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

export default function IncidentsView() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closeTarget, setCloseTarget] = useState<Incident | null>(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setIncidents(await api.getIncidents());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar incidentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClose = async () => {
    if (!closeTarget) return;
    try {
      await api.closeIncident(closeTarget.id);
      setCloseTarget(null);
      setNotice('Incidente cerrado.');
      await load();
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cerrar incidente');
    }
  };

  const openCount = incidents.filter(i => i.status === 'open').length;
  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
          Incidentes de Seguridad
          {openCount > 0 && (
            <span className="ml-1 text-label font-bold px-2 py-0.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 align-middle">
              {openCount} abierto{openCount !== 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Agrupación de accesos denegados repetidos (umbral configurable).</p>
      </div>

      {notice && (
        <div role="status" className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-green-800 dark:text-green-300 font-medium">{notice}</p>
        </div>
      )}
      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
            <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
            <p className="text-sm">Cargando incidentes...</p>
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
            <ShieldWarning className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No hay incidentes registrados</p>
            <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">Se generan cuando hay rechazos repetidos en la ventana configurada.</p>
          </div>
        ) : (
          incidents.map(incident => (
            <div key={incident.id} className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm transition-all ${
              incident.status === 'open' ? 'border-red-200 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    incident.status === 'open' ? 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    <WarningOctagon className="w-5 h-5" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">
                        {incident.type === 'repeated_denials' ? 'Rechazos repetidos' : 'Anomalía de kiosco'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-label font-bold ${
                        incident.status === 'open' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {incident.status === 'open' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {incident.count} rechazos en {incident.windowMinutes} min
                      {incident.labCode ? ` · Lab ${incident.labCode}` : ''}
                      {incident.kioskId ? ` · ${incident.kioskId}` : ''}
                      {incident.reason ? ` · ${incident.reason}` : ''}
                    </p>
                    <p className="flex items-center gap-1.5 mt-1 text-caption font-mono text-zinc-400 dark:text-zinc-500">
                      <Clock className="w-3 h-3" weight="regular" />
                      {formatDate(incident.firstSeen)} → {formatDate(incident.lastSeen)}
                    </p>
                  </div>
                </div>
                {incident.status === 'open' && (
                  <button onClick={() => setCloseTarget(incident)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition-all cursor-pointer">
                    Cerrar incidente
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={closeTarget !== null}
        title="Cerrar incidente"
        message={`¿Marcar como resuelto el incidente "${closeTarget?.id}" (${closeTarget?.count} rechazos)? Se conservará el registro para auditoría.`}
        confirmLabel="Cerrar incidente"
        variant="default"
        onConfirm={handleClose}
        onCancel={() => setCloseTarget(null)}
      />
    </div>
  );
}
