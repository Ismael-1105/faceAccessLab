import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Student as StudentIcon, Flask, Camera as CameraIcon, CheckCircle, ArrowRight, ArrowLeft,
  Image as ImageIcon, UploadSimple, Scan, Fingerprint, WarningOctagon
} from '@phosphor-icons/react';
import type { Student } from '../types.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

interface EnrollmentViewProps {
  onComplete: (student: Student) => void;
  onCancel: () => void;
}

type StepIndex = 0 | 1 | 2;

const STEPS = [
  { label: 'Datos personales', icon: User },
  { label: 'Captura biométrica', icon: CameraIcon },
  { label: 'Confirmación', icon: CheckCircle },
];

const LABS = [
  { value: 'LAB-01', label: 'LAB-01 (Redes)' },
  { value: 'LAB-02', label: 'LAB-02 (Sistemas Operativos)' },
  { value: 'Biblioteca', label: 'Biblioteca del Campus' },
];

const DEFAULT_AVATAR = '/images/default-avatar.jpg';

export default function EnrollmentView({ onComplete, onCancel }: EnrollmentViewProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [name, setName] = useState('');
  const [career, setCareer] = useState('');
  const [lab, setLab] = useState('LAB-02');
  const [matchPct, setMatchPct] = useState(95);
  const [useWebcam, setUseWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [webcamError, setWebcamError] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const startWebcam = async () => {
    try {
      setWebcamError(false);
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      setStream(s);
      setUseWebcam(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch {
      setUseWebcam(false);
      setWebcamError(true);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setUseWebcam(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopWebcam();
    setIsCapturing(false);
  };

  const handleSubmit = () => {
    const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'N';
    const student: Student = {
      id: 'student-' + Math.random().toString(36).substr(2, 9),
      name,
      career,
      lab,
      photoUrl: capturedImage || DEFAULT_AVATAR,
      matchPercentage: matchPct,
      status: 'allowed',
      avatarInitials: initials,
    };
    onComplete(student);
  };

  const hasEnteredData = name.trim().length > 0 || career.trim().length > 0 || capturedImage !== null;

  const handleCancel = () => {
    if (hasEnteredData) {
      setConfirmCancelOpen(true);
    } else {
      onCancel();
    }
  };

  const canGoNext = () => {
    if (step === 0) return name.trim().length > 0 && career.trim().length > 0;
    if (step === 1) return capturedImage !== null;
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden max-w-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" weight="fill" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Matriculación Biométrica</h3>
            <p className="text-label text-zinc-400 dark:text-zinc-500">Registro de nuevo alumno</p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
        >
          <X className="w-4 h-4" weight="bold" />
        </button>
      </div>

      {/* Steps indicator */}
      <div className="flex px-5 pt-5 pb-0 gap-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex-1 flex items-center">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-accent-600 dark:text-accent-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
              {i < step ? (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold transition-all bg-accent-600 text-white">
                  <CheckCircle className="w-3.5 h-3.5" weight="fill" />
                </div>
              ) : i === step ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold transition-all bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 border-2 border-accent-600 dark:border-accent-400">
                  {i + 1}
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600">
                  {i + 1}
                </div>
              )}
              <span className="text-label font-semibold hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? 'bg-accent-600' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Datos personales */}
            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Nombre completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                    <input type="text" required placeholder="Ej. Sofia Villarreal"
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full text-xs p-2.5 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-label font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Carrera</label>
                  <div className="relative">
                    <StudentIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                    <input type="text" required placeholder="Ej. Ingeniería de Sistemas"
                      value={career} onChange={e => setCareer(e.target.value)}
                      className="w-full text-xs p-2.5 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-label font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Laboratorio</label>
                  <div className="relative">
                    <Flask className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4 z-10" weight="regular" />
                    <select value={lab} onChange={e => setLab(e.target.value)}
                      className="w-full text-xs p-2.5 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all appearance-none">
                      {LABS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Captura biométrica */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-video flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 cursor-crosshair">
                  {useWebcam ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover cursor-crosshair" />
                  ) : capturedImage ? (
                    <img src={capturedImage} alt="Captura realizada" className="w-full h-full object-cover" />
                  ) : isCapturing ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-400">
                      <Scan className="w-10 h-10 animate-pulse" weight="regular" />
                      <span className="text-xs font-mono animate-pulse">Escaneando...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-400">
                      <CameraIcon className="w-10 h-10" weight="regular" />
                      <span className="text-xs">Captura el rostro del alumno</span>
                    </div>
                  )}
                  {useWebcam && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      <button onClick={capturePhoto}
                        className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer">
                        <CameraIcon className="w-4 h-4" weight="fill" />
                        Capturar
                      </button>
                      <button onClick={stopWebcam}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer">
                        Detener
                      </button>
                    </div>
                  )}
                  {capturedImage && !useWebcam && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      <button onClick={() => { setCapturedImage(null); }}
                        className="px-4 py-2 bg-zinc-700/80 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer">
                        Repetir
                      </button>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="flex justify-center gap-3">
                  {!useWebcam && !capturedImage && !isCapturing && (
                    <>
                      <button onClick={startWebcam}
                        className="px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer">
                        <CameraIcon className="w-4 h-4" weight="fill" />
                        Usar cámara web
                      </button>
                    </>
                  )}
                </div>

                <p className="text-label text-zinc-400 dark:text-zinc-500 text-center">
                  La captura se almacenará de forma segura en Amazon S3 con cifrado AES-256.
                </p>

                {webcamError && (
                  <div className="mt-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2.5">
                    <WarningOctagon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" weight="fill" />
                    <div>
                      <p className="text-caption font-semibold text-red-700 dark:text-red-400">No se pudo acceder a la cámara</p>
                      <p className="text-label text-red-600 dark:text-red-400/80 mt-0.5">Verifica que los permisos de cámara estén habilitados en tu navegador.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Confirmación */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 flex-shrink-0">
                    {capturedImage ? (
                      <img src={capturedImage} alt="Vista previa" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400">
                        <User className="w-6 h-6" weight="regular" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{career || 'Sin carrera'}</p>
                    <p className="text-label font-mono text-zinc-400 dark:text-zinc-500">{lab} · Umbral {matchPct}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Nombre', value: name },
                    { label: 'Carrera', value: career },
                    { label: 'Laboratorio', value: lab },
                    { label: 'Umbral mínimo', value: `${matchPct}%` },
                    { label: 'Estado inicial', value: 'Habilitado', badge: true },
                    { label: 'Foto capturada', value: capturedImage ? 'Sí' : 'No (usará default)' },
                  ].map(({ label, value, badge }) => (
                    <div key={label} className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-label font-semibold text-zinc-400 dark:text-zinc-500 uppercase">{label}</p>
                      <p className={`text-xs font-bold mt-0.5 text-zinc-900 dark:text-white ${badge ? 'text-green-600 dark:text-green-400' : ''}`}>
                        {value || <span className="text-zinc-400">—</span>}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                  <p className="text-label text-amber-700 dark:text-amber-400 font-medium">
                    Al confirmar, se generará un perfil biométrico seguro. El alumno podrá acceder al laboratorio inmediatamente.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
        <button
          onClick={step === 0 ? handleCancel : () => setStep((step - 1) as StepIndex)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
          {step === 0 ? 'Cancelar' : 'Anterior'}
        </button>
        {step < 2 ? (
          <button
            onClick={() => setStep((step + 1) as StepIndex)}
            disabled={!canGoNext()}
            className="inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            Siguiente
            <ArrowRight className="w-3.5 h-3.5" weight="bold" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" weight="fill" />
            Cargar Biometría
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Descartar registro"
        message="Los datos ingresados se perderán si cancelas la matriculación. ¿Deseas continuar?"
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        variant="danger"
        onConfirm={() => { setConfirmCancelOpen(false); onCancel(); }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </motion.div>
  );
}

