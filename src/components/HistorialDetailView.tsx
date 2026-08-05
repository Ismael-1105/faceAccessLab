'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, SignIn, Prohibit, ShieldWarning, WarningOctagon, Clock,
  Flask, IdentificationBadge, CheckCircle, XCircle, CircleNotch, ArrowSquareOut,
  User, CalendarBlank,
} from '@phosphor-icons/react';
import { api } from '../lib/api.ts';
import type { HistorialEntry } from './HistorialView.tsx';

interface HistorialDetailViewProps {
  entry: HistorialEntry;
  studentName: (id?: string) => string | undefined;
  onBack: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-label font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold">{label}</p>
      <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'red' | 'amber' | 'zinc' }) {
  const cls = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
    zinc: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  }[tone];
  return <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${cls}`}>{children}</span>;
}

export default function HistorialDetailView({ entry, studentName, onBack }: HistorialDetailViewProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (entry.kind !== 'evidencia') return;
    setPhotoLoading(true);
    api.getEvidencePhotoUrl(entry.item.photoKey)
      .then(({ url }) => setPhotoUrl(url))
      .catch(() => setPhotoError('No se pudo cargar la fotografía'))
      .finally(() => setPhotoLoading(false));
  }, [entry]);

  const openFull = () => { if (photoUrl) window.open(photoUrl, '_blank', 'noopener'); };

  const isAccess = entry.kind === 'acceso';
  const isEvidence = entry.kind === 'evidencia';
  const isIncident = entry.kind === 'incidente';

  const icon = isAccess
    ? (entry.item.result === 'Permitido' ? <SignIn className="w-5 h-5" weight="fill" /> : <Prohibit className="w-5 h-5" weight="fill" />)
    : isEvidence ? <WarningOctagon className="w-5 h-5" weight="fill" /> : <ShieldWarning className="w-5 h-5" weight="fill" />;

  const iconCls = isAccess
    ? (entry.item.result === 'Permitido' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400')
    : isEvidence ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400';

  const title = isAccess
    ? `Acceso · ${entry.item.studentName}`
    : isEvidence
      ? 'Evidencia de acceso denegado'
      : (entry.item.type === 'repeated_denials' ? 'Incidente · Rechazos repetidos' : 'Incidente · Anomalía de kiosco');

  const name = isAccess
    ? entry.item.studentName
    : studentName(isEvidence ? entry.item.studentId : entry.item.studentId) || '—';

  return (
    <div className="space-y-5">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-caption font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
        Volver al historial
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconCls}`}>{icon}</div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono">{entry.item.id}</p>
          </div>
          <div className="ml-auto shrink-0">
            {isAccess ? (
              entry.item.result === 'Permitido' ? <Badge tone="green">Permitido</Badge> : <Badge tone="red">Denegado</Badge>
            ) : isEvidence ? (
              <Badge tone="amber">Evidencia</Badge>
            ) : (
              entry.item.status === 'open' ? <Badge tone="red">Abierto</Badge> : <Badge tone="zinc">Cerrado</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Datos generales */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Información general</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Estudiante">
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-zinc-400" weight="regular" />{name}</span>
          </Field>
          <Field label="Fecha">
            <span className="flex items-center gap-1.5 font-mono"><CalendarBlank className="w-3.5 h-3.5 text-zinc-400" weight="regular" />{isAccess ? entry.item.date : new Date(entry.item.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </Field>
          <Field label="Hora">
            <span className="flex items-center gap-1.5 font-mono"><Clock className="w-3.5 h-3.5 text-zinc-400" weight="regular" />{isAccess ? entry.item.time : new Date(entry.item.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          </Field>
          <Field label="Laboratorio">
            <span className="flex items-center gap-1.5 font-mono"><Flask className="w-3.5 h-3.5 text-zinc-400" weight="regular" />{entry.item.labCode || '—'}</span>
          </Field>
          <Field label="Kiosco">
            <span className="flex items-center gap-1.5 font-mono"><IdentificationBadge className="w-3.5 h-3.5 text-zinc-400" weight="regular" />{entry.item.kioskId || '—'}</span>
          </Field>
          <Field label="Registro">
            <span className="font-mono">{entry.item.id}</span>
          </Field>
        </div>
      </div>

      {/* Detalle específico por tipo */}
      {isAccess && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Detalle del acceso</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Resultado">
              {entry.item.result === 'Permitido'
                ? <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold"><CheckCircle className="w-4 h-4" weight="fill" />Permitido</span>
                : <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold"><XCircle className="w-4 h-4" weight="fill" />Denegado</span>}
            </Field>
            <Field label="Similitud">
              <span className="font-mono font-bold">{entry.item.similarity > 0 ? `${entry.item.similarity}%` : '—'}</span>
            </Field>
            <Field label="Motivo">
              <span className="font-mono">{entry.item.reason || '—'}</span>
            </Field>
            <Field label="ID estudiante">
              <span className="font-mono">{entry.item.studentId || '—'}</span>
            </Field>
          </div>
        </div>
      )}

      {isEvidence && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Evidencia fotográfica</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Motivo del rechazo">
              <span className="font-mono font-semibold text-red-600 dark:text-red-400">{entry.item.reason}</span>
            </Field>
            <Field label="Confianza del match">
              <span className="font-mono font-bold">{entry.item.confidence > 0 ? `${entry.item.confidence.toFixed(1)}%` : '—'}</span>
            </Field>
          </div>
          <div className="mt-4">
            <p className="text-label font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold mb-2">Fotografía</p>
            <div className="rounded-xl overflow-hidden bg-zinc-900 aspect-[4/3] max-w-md flex items-center justify-center">
              {photoLoading ? (
                <CircleNotch className="w-6 h-6 text-zinc-500 animate-spin" weight="bold" />
              ) : photoUrl ? (
                <img src={photoUrl} alt="Evidencia de acceso denegado" className="w-full h-full object-contain" />
              ) : (
                <p className="text-xs text-zinc-500 p-4">{photoError || 'Fotografía no disponible'}</p>
              )}
            </div>
            {photoUrl && (
              <button onClick={openFull}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-950/50 transition-all cursor-pointer">
                <ArrowSquareOut className="w-3.5 h-3.5" weight="regular" />
                Ver foto en tamaño completo
              </button>
            )}
          </div>
        </div>
      )}

      {isIncident && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Detalle del incidente</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Tipo">
              <span className="font-semibold">{entry.item.type === 'repeated_denials' ? 'Rechazos repetidos' : 'Anomalía de kiosco'}</span>
            </Field>
            <Field label="Estado">
              {entry.item.status === 'open' ? <Badge tone="red">Abierto</Badge> : <Badge tone="zinc">Cerrado</Badge>}
            </Field>
            <Field label="Conteo">
              <span className="font-mono font-bold">{entry.item.count}</span>
            </Field>
            <Field label="Ventana">
              <span className="font-mono">{entry.item.windowMinutes} min</span>
            </Field>
            <Field label="Primera vez">
              <span className="font-mono">{new Date(entry.item.firstSeen).toLocaleString('es-MX')}</span>
            </Field>
            <Field label="Última vez">
              <span className="font-mono">{new Date(entry.item.lastSeen).toLocaleString('es-MX')}</span>
            </Field>
            <Field label="Cerrado">
              <span className="font-mono">{entry.item.closedAt ? new Date(entry.item.closedAt).toLocaleString('es-MX') : '—'}</span>
            </Field>
            <Field label="Motivo">
              <span className="font-mono">{entry.item.reason || '—'}</span>
            </Field>
          </div>
          <div className="mt-4">
            <p className="text-label font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold mb-2">Evidencias asociadas ({entry.item.evidenceIds.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {entry.item.evidenceIds.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Sin evidencias vinculadas.</p>
              ) : (
                entry.item.evidenceIds.map(id => (
                  <span key={id} className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-caption">{id}</span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
