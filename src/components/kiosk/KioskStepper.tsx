'use client';

import {
  Check, X, Printer, ScanFace, ShieldCheck, Database, LockOpen, Lock, User, Loader2, Radio,
  ShieldAlert, UserRoundX, Timer, TriangleAlert,
} from 'lucide-react';
import type { Student } from '@/src/types';
import type { FlowState } from '@/src/hooks/useKioskFlow';
import { getPhotoSrc } from '@/src/lib/photoUrl';
import {
  DENIAL_REASONS,
  SCAN_STAGES,
  type DenialReason,
  type ScanStageId,
} from '@/src/lib/kiosk-feedback';

const STAGE_ICON: Record<ScanStageId, typeof ScanFace> = {
  capture: ScanFace,
  liveness: ShieldCheck,
  compare: Database,
  authorize: LockOpen,
};

/** Etapa en la que se detiene el proceso según la causa del rechazo. */
const FAILING_STAGE: Record<DenialReason, ScanStageId> = {
  'capture-failed': 'capture',
  'liveness-failed': 'liveness',
  'no-match': 'compare',
  'low-confidence': 'compare',
  'no-student-record': 'compare',
  'not-enrolled': 'compare',
  'network-error': 'compare',
  permissions: 'authorize',
  'out-of-schedule': 'authorize',
  'class-not-started': 'authorize',
  'class-ended': 'authorize',
  'class-cancelled': 'authorize',
  'wrong-lab': 'authorize',
  virtual: 'authorize',
  'no-biometric': 'authorize',
  'consent-expired': 'authorize',
};

interface KioskStepperProps {
  flowState: FlowState;
  activeStage: ScanStageId;
  statusMessage: string;
  statusHint: string;
  isSuccess: boolean;
  denialReason: DenialReason | null;
  scannedStudent: Student | null;
  /**
   * URL firmada que entrega /api/kiosk/verify (ISS-15). Opcional: el kiosco no
   * tiene sesión, así que sin ella no hay forma de mostrar una foto de S3 y se
   * cae al fondo genérico de getPhotoSrc.
   */
  scannedPhotoUrl?: string | null;
  confidence: number;
  resetCountdown: number;
  consecutiveDenials: number;
  /** Datos de la clase vigente del kiosco (pre-reconocimiento). */
  sessionInfo?: { subject?: string; teacherName?: string | null; startTime?: string; endTime?: string } | null;
  onPrintReceipt: () => void;
}

export default function KioskStepper({
  flowState,
  activeStage,
  statusMessage,
  statusHint,
  isSuccess,
  denialReason,
  scannedStudent,
  scannedPhotoUrl,
  confidence,
  resetCountdown,
  consecutiveDenials,
  sessionInfo,
  onPrintReceipt,
}: KioskStepperProps) {
  const denial = denialReason ? DENIAL_REASONS[denialReason] : null;
  const failedStage = denialReason ? FAILING_STAGE[denialReason] : null;
  const activeIdx = SCAN_STAGES.findIndex(s => s.id === activeStage);
  const failedIdx = failedStage ? SCAN_STAGES.findIndex(s => s.id === failedStage) : -1;
  const isResult = flowState === 'result';

  return (
    <section className="md:col-span-5 lg:col-span-4 flex flex-col animate-kiosk-fade-in">
      {/* Card del stepper */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-[20px] p-6 lg:p-7 shadow-sm lg:max-h-[460px] lg:overflow-y-auto">
        <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2 mb-6">
          <Radio className="w-3.5 h-3.5 text-accent-500 dark:text-accent-400" />
          Proceso de verificación
        </p>

        {/* Sesión vigente: laboratorio, materia, docente y horario */}
        {sessionInfo && !isResult && (
          <div className="mb-6 rounded-2xl bg-accent-50 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-800/40 p-4 space-y-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-accent-700 dark:text-accent-300">
              Sesión en curso
            </p>
            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{sessionInfo.subject ?? '—'}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Docente: {sessionInfo.teacherName ?? '—'}</p>
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {sessionInfo.startTime ?? '--:--'} – {sessionInfo.endTime ?? '--:--'}
            </p>
          </div>
        )}

        {/* Stepper vertical */}
        <div className="space-y-0">
          {SCAN_STAGES.map((stage, i) => {
            const StageIcon = STAGE_ICON[stage.id];
            const errorStep = isResult && failedIdx === i;
            const completed = isResult
              ? (failedIdx === -1 || i < failedIdx)
              : i < activeIdx;
            const active = !isResult && i === activeIdx && flowState !== 'idle' && flowState !== 'framing';

            return (
              <div key={stage.id} className="flex gap-4 items-start pb-6 relative">
                {/* Línea vertical conectora */}
                {i < SCAN_STAGES.length - 1 && (
                  <span
                    className={`absolute left-5 top-11 bottom-0 w-px transition-colors duration-300 ${
                      completed ? 'bg-green-300 dark:bg-green-800/60' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                )}

                {/* Ícono del paso */}
                <div
                  className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    errorStep
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                      : completed
                        ? 'bg-green-50 dark:bg-green-900/25 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                        : active
                          ? 'bg-accent-50 dark:bg-accent-950/30 border-accent-300 dark:border-accent-700 text-accent-600 dark:text-accent-400'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {errorStep ? <X className="w-5 h-5" strokeWidth={2.5} /> :
                   completed ? <Check className="w-5 h-5" strokeWidth={2.5} /> :
                   active ? <Loader2 className="w-5 h-5 animate-spin" /> :
                   <StageIcon className="w-5 h-5" />}
                </div>

                {/* Texto del paso */}
                <div className="pt-1.5 min-w-0">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    errorStep ? 'text-red-600 dark:text-red-400' :
                    completed ? 'text-green-700 dark:text-green-400' :
                    active ? 'text-accent-700 dark:text-accent-300' :
                    'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {stage.label}
                  </p>
                  <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                    active ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {errorStep && denial ? denial.title
                      : active ? statusMessage
                      : completed ? 'Completado'
                      : stage.desc}
                  </p>
                  {active && statusHint && (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{statusHint}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card del desenlace */}
      {isResult && (
        <div
          className={`mt-4 rounded-[20px] p-6 border transition-all duration-300 animate-kiosk-scale-in ${
            isSuccess
              ? 'bg-green-50/70 dark:bg-green-950/20 border-green-200 dark:border-green-800/40'
              : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 flex items-center justify-center ${
              isSuccess ? 'border-green-400 dark:border-green-500' : 'border-red-400 dark:border-red-500'
            }`}>
              {scannedStudent ? (
                <img
                  className="w-full h-full object-cover"
                  alt={scannedStudent.name}
                  src={scannedPhotoUrl ?? getPhotoSrc(scannedStudent.photoUrl)}
                  onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                />
              ) : (
                <UserRoundX className="w-7 h-7 text-red-400 dark:text-red-500" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {isSuccess ? 'Identidad verificada' : scannedStudent ? 'Identidad verificada' : 'Sin identificar'}
              </p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white truncate flex items-center gap-2">
                <User className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                {scannedStudent?.name ?? 'Persona no reconocida'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {scannedStudent ? `${scannedStudent.career} · ${scannedStudent.lab}` : 'Ningún registro asociado'}
              </p>
            </div>
          </div>

          {/* Acceso concedido: materia, docente, hora y asistencia registrada */}
          {isSuccess && (
            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800/40 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-400">Materia</p>
                <p className="font-semibold text-green-900 dark:text-green-300 truncate">{sessionInfo?.subject ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-400">Docente</p>
                <p className="font-semibold text-green-900 dark:text-green-300 truncate">{sessionInfo?.teacherName ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-400">Hora de ingreso</p>
                <p className="font-semibold text-green-900 dark:text-green-300 font-mono">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-green-700 dark:text-green-400">Asistencia</p>
                <p className="font-semibold text-green-900 dark:text-green-300">Registrada · Presente</p>
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSuccess ? (
                <LockOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-sm font-bold ${isSuccess ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {isSuccess ? 'Desbloqueado' : 'Bloqueado'}
              </span>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${
              isSuccess
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
            }`}>
              {confidence > 0 ? `${confidence.toFixed(1)}%` : 'Sin similitud'}
            </span>
          </div>

          {denial && (
            <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2 min-w-0">
                  <p className="text-[11px] font-mono font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                    Motivo {denial.code}
                  </p>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">{denial.title}</p>
                  <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{denial.detail}</p>
                  <div className="flex items-start gap-2 pt-1">
                    <span className="text-red-400 text-xs mt-0.5" aria-hidden="true">&rarr;</span>
                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{denial.action}</p>
                  </div>
                  {consecutiveDenials >= 5 && (
                    <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-3 py-2">
                      <TriangleAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold text-red-800 dark:text-red-300 leading-relaxed">
                        Se han registrado {consecutiveDenials} intentos fallidos consecutivos. El acceso quedará
                        bloqueado temporalmente durante {resetCountdown > 0 ? resetCountdown : 30} segundos.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {resetCountdown > 0 && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <Timer className="w-3.5 h-3.5" aria-hidden="true" />
              El kiosco se reinicia en {resetCountdown} s
            </p>
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
