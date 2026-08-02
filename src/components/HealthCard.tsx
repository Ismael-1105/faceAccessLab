'use client';

import React, { useEffect, useState } from 'react';
import { Database, Cloud, ShieldCheck, Pulse, CircleNotch, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { SystemHealth } from '../types.ts';
import { api } from '../lib/api.ts';

export default function HealthCard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar el estado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const mongoOk = health?.mongo.connected;
  const cwOk = health?.cloudwatch.ok;

  const Row = ({ icon, label, ok, detail }: { icon: React.ElementType; label: string; ok: boolean | undefined; detail: string }) => {
    const Icon = icon;
    return (
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" weight="regular" />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-label font-mono text-zinc-400 dark:text-zinc-500">{detail}</span>
          {ok ? (
            <CheckCircle className="w-4 h-4 text-green-500" weight="fill" />
          ) : (
            <WarningCircle className="w-4 h-4 text-red-500" weight="fill" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Pulse className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
          Salud del Ecosistema
        </h4>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="text-xs text-accent-600 dark:text-accent-400 font-semibold hover:underline transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Verificar'}
        </button>
      </div>

      {loading && !health ? (
        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
          <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
          <p className="text-xs">Consultando servicios...</p>
        </div>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : health ? (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <Row icon={Database} label="MongoDB" ok={mongoOk} detail={mongoOk ? `${health.mongo.counts?.students ?? 0} alumnos` : 'Desconectado'} />
          <Row icon={Cloud} label="CloudWatch" ok={cwOk} detail={cwOk ? `${health.cloudwatch.metrics?.faces_searched ?? 0} búsquedas` : 'Sin métricas'} />
          <Row icon={ShieldCheck} label="AWS" ok={health.aws.configured} detail={health.aws.configured ? health.aws.region : 'No configurado'} />
          <Row icon={Pulse} label="Estado general" ok={health.ok} detail={health.ok ? 'Operativo' : 'Con incidencias'} />
        </div>
      ) : null}
    </div>
  );
}

