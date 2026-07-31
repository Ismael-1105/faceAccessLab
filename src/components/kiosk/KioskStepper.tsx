'use client';

import {
  Check, X, Printer, ScanFace, ShieldCheck, Database, LockOpen, Lock, User, Loader2, Radio, ShieldAlert,
} from 'lucide-react';
import type { Student } from '@/src/types';

const STEPS = [
  { id: 'detecting', label: 'Detectando rostro', desc: 'Buscando tu rostro', icon: ScanFace },
  { id: 'verifying', label: 'Verificando identidad', desc: 'Analizando biometría', icon: ShieldCheck },
  { id: 'comparing', label: 'Comparando registros', desc: 'Consultando base', icon: Database },
  { id: 'authorizing', label: 'Validando permisos', desc: 'Comprobando acceso', icon: LockOpen },
] as const;

type StepId = typeof STEPS[number]['id'];

export type { StepId };

interface KioskStepperProps {
  flowState: 'idle' | 'detecting' | 'liveness' | 'scanning' | 'result';
  activeStep: StepId;
  statusMessage: string;
  isAllowed: boolean;
  scannedStudent: Student | null;
  confidence: number;
  onPrintReceipt: () => void;
}

export default function KioskStepper({
  flowState,
  activeStep,
  statusMessage,
  isAllowed,
  scannedStudent,
  confidence,
  onPrintReceipt,
}: KioskStepperProps) {
  const idx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <section className="md:col-span-5 lg:col-span-4 flex flex-col animate-kiosk-fade-in">
      {/* Card del stepper */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-[20px] p-6 lg:p-7 shadow-sm lg:max-h-[460px] lg:overflow-y-auto">
        <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2 mb-6">
          <Radio className="w-3.5 h-3.5 text-accent-500 dark:text-accent-400" />
          Proceso de verificación
        </p>

        {/* Stepper vertical */}
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const completed = i < idx || (flowState === 'result' && isAllowed && i < 3);
            const active = i === idx && !(flowState === 'result' && isAllowed);
            const errorStep = flowState === 'result' && !isAllowed && i === 2;

            return (
              <div key={step.id} className="flex gap-4 items-start pb-6 relative">
                {/* Línea vertical conectora */}
                {i < STEPS.length - 1 && (
                  <span
                    className={`absolute left-5 top-11 bottom-0 w-px transition-colors duration-300 ${
                      completed ? 'bg-green-300 dark:bg-green-800/60' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                )}

                {/* Ícono del paso */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    completed
                      ? 'bg-green-50 dark:bg-green-900/25 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                      : active
                        ? 'bg-accent-50 dark:bg-accent-950/30 border-accent-300 dark:border-accent-700 text-accent-600 dark:text-accent-400'
                        : errorStep
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {completed ? <Check className="w-5 h-5" strokeWidth={2.5} /> :
                   active ? <Loader2 className="w-5 h-5 animate-spin" /> :
                   errorStep ? <X className="w-5 h-5" /> :
                   <StepIcon className="w-5 h-5" />}
                </div>

                {/* Texto del paso */}
                <div className="pt-1.5 min-w-0">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    completed ? 'text-green-700 dark:text-green-400' :
                    active ? 'text-accent-700 dark:text-accent-300' :
                    errorStep ? 'text-red-600 dark:text-red-400' :
                    'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                    active ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {active ? statusMessage : completed ? 'Completado' : step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card del estudiante al completar */}
      {flowState === 'result' && scannedStudent && (
        <div
          className={`mt-4 rounded-[20px] p-6 border transition-all duration-300 animate-kiosk-scale-in ${
            isAllowed
              ? 'bg-green-50/70 dark:bg-green-950/20 border-green-200 dark:border-green-800/40'
              : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
              isAllowed ? 'border-green-400 dark:border-green-500' : 'border-red-400 dark:border-red-500'
            }`}>
              <img
                className="w-full h-full object-cover"
                alt={scannedStudent.name}
                src={scannedStudent.photoUrl}
                onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {isAllowed ? 'Identidad verificada' : 'Identidad no reconocida'}
              </p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white truncate flex items-center gap-2">
                <User className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                {scannedStudent.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {scannedStudent.career} · {scannedStudent.lab}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAllowed ? (
                <LockOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-sm font-bold ${isAllowed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {isAllowed ? 'Desbloqueado' : 'Bloqueado'}
              </span>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${
              isAllowed
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
            }`}>
              {confidence.toFixed(1)}%
            </span>
          </div>

          {!isAllowed && (
            <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2 min-w-0">
                  <p className="text-[11px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Posibles causas</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                      <span><strong className="font-semibold">R01</strong> Rostro no identificado en base de datos del laboratorio</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                      <span><strong className="font-semibold">R02</strong> Cuenta suspendida o sin permisos activos</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                      <span><strong className="font-semibold">R03</strong> Calidad de captura insuficiente (iluminación, ángulo, oclusión)</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0" />
                      <span><strong className="font-semibold">R04</strong> Verificación de liveness no superada</span>
                    </li>
                  </ul>
                  <div className="flex items-start gap-2 pt-1">
                    <span className="text-red-400 text-xs mt-0.5">→</span>
                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                      Acude al <strong className="font-semibold">Departamento de Sistemas</strong> para verificar tu registro biométrico o consultar el estado de tu cuenta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onPrintReceipt}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3.5 min-h-12 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            Bajar recibo
          </button>
        </div>
      )}
    </section>
  );
}
