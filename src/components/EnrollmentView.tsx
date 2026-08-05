import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, User, Student as StudentIcon, Flask, Camera as CameraIcon, CheckCircle,
  ArrowRight, Scan, Fingerprint, WarningOctagon, Clock,
  Envelope, Phone, ShieldCheck, CircleNotch,
  LockSimple,
} from '@phosphor-icons/react';
import type { Student, Career } from '../types.ts';
import { CAREERS } from '../types.ts';
import { api, getToken } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import ConfirmDialog from './ConfirmDialog.tsx';

async function uploadToS3(imageBase64: string, studentId: string): Promise<{ url: string; key: string } | null> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({ imageBase64, studentId }),
    });
    const data = await res.json();
    if (data.ok) return { url: data.url, key: data.key };
    console.error('[Upload] Respuesta no-ok:', data.error || data);
    return null;
  } catch (err) {
    console.error('[Upload] Error de red al subir a S3:', err);
    return null;
  }
}

interface EnrollmentViewProps {
  onComplete: (student: Student) => void;
  onCancel: () => void;
  /** Clase en la que se matricula: su lab y horario se muestran como fijos. */
  scheduleId?: string;
}

const FALLBACK_LABS = [
  { value: 'LAB-02', label: 'LAB-02 (Sistemas Operativos)', desc: 'Laboratorio de sistemas operativos' },
];

const DEFAULT_AVATAR = '/images/default-avatar.jpg';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const inputClass =
  'w-full text-xs p-3 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all';

export default function EnrollmentView({ onComplete, onCancel, scheduleId }: EnrollmentViewProps) {
  const { user } = useApp();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [career, setCareer] = useState<Career>(CAREERS[0].value);
  const [phone, setPhone] = useState('');

  // Lab/aula asignado: es fijo (retroalimentación), no seleccionable.
  const [assignedLab, setAssignedLab] = useState<string>(user?.labCode || '');
  const [scheduleInfo, setScheduleInfo] = useState<{ id: string; subject: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string } | null>(null);
  /** Clases del docente autenticado (filtradas por rol en el servidor). */
  const [teacherSchedules, setTeacherSchedules] = useState<{ id: string; subject: string; labCode: string; dayOfWeek: number; startTime: string; endTime: string }[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(scheduleId || '');

  const [useWebcam, setUseWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [webcamError, setWebcamError] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [availableLabs, setAvailableLabs] = useState(FALLBACK_LABS);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    api.getLabs()
      .then(labs => {
        const active = labs.filter(l => l.active);
        if (active.length > 0) {
          setAvailableLabs(active.map(l => ({
            value: l.code,
            label: `${l.code} (${l.name})`,
            desc: l.description || `Laboratorio ${l.code}`,
          })));
        }
      })
      .catch(() => {});

    // Si se matricula dentro de una clase concreta, el lab y el horario se
    // muestran como fijos (se heredan de la clase; no se pueden cambiar).
    api.getSchedules()
      .then(list => {
        const mine = list.map(s => ({ id: s.id, subject: s.subject, labCode: s.labCode, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }));
        setTeacherSchedules(mine);

        // Preselección: la clase pasada como prop, o la primera del docente.
        const preset = mine.find(s => s.id === (scheduleId || selectedScheduleId)) || mine[0];
        if (preset) {
          setSelectedScheduleId(preset.id);
          setScheduleInfo(preset);
          setAssignedLab(preset.labCode);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
    };
  }, [stream, capturedBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play().catch(() => {});
    return () => { video.srcObject = null; };
  }, [stream]);

  const startWebcam = async () => {
    try {
      setWebcamError(false);
      if (stream) stream.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      setStream(s);
      setUseWebcam(true);
    } catch (err) {
      console.error('[Webcam] Error:', err);
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
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCountdown = () => {
    if (!videoRef.current) return;
    setCountdown(3);
    setIsCapturing(true);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          capturePhoto();
          return 0;
        }
        return prev - 1;
      });
    }, 800);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
        setCapturedBlobUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.onloadend = () => setCapturedImage(reader.result as string);
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.85,
    );

    stopWebcam();
    setIsCapturing(false);
    setCaptureSuccess(true);
    setTimeout(() => setCaptureSuccess(false), 1500);
  };

  const clearForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setCareer(CAREERS[0].value);
    setPhone('');
    setCapturedImage(null);
    setCapturedBlobUrl(null);
    setCaptureSuccess(false);
    setRegistrationError('');
    setFieldErrors({});
    stopWebcam();
  };

  /** Al cambiar la clase, se fijan el lab y el horario como retroalimentación. */
  const selectSchedule = (id: string) => {
    const s = teacherSchedules.find(x => x.id === id);
    if (!s) return;
    setSelectedScheduleId(id);
    setScheduleInfo(s);
    setAssignedLab(s.labCode);
  };

  const validateFields = () => {
    const errors: { email?: string; phone?: string } = {};
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errors.email = 'Ingresa un correo válido (ej. alumno@uide.edu.ec)';
    }
    if (phone.trim() && !/^\d{7,10}$/.test(phone.trim())) {
      errors.phone = 'El teléfono debe contener entre 7 y 10 dígitos';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateFields()) {
      setRegistrationError('Revisa los campos marcados en el formulario.');
      return;
    }
    setRegistering(true);
    setRegistrationError('');

    const fullName = `${firstName} ${lastName}`.trim();
    const initials = fullName.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'N';
    const studentId = 'student-' + Math.random().toString(36).substr(2, 9);

    let s3Url: string | null = null;
    let s3Key: string | null = null;
    let faceId: string | null = null;

    if (capturedImage && capturedImage.startsWith('data:')) {
      const s3Result = await uploadToS3(capturedImage, studentId);
      if (!s3Result) {
        setRegistrationError('Error al subir la imagen. Verifica tu conexión.');
        setRegistering(false);
        return;
      }
      s3Url = s3Result.url;
      s3Key = s3Result.key;

      const rekogRes = await fetch('/api/rekognition/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ studentId, imageBase64: capturedImage }),
      });
      const rekogData = await rekogRes.json();

      if (!rekogData.ok) {
        setRegistrationError(rekogData.message || 'Error al registrar el rostro. Intenta de nuevo.');
        setRegistering(false);
        return;
      }

      faceId = rekogData.faceId || null;
    }

    const student: Student = {
      id: studentId,
      name: fullName,
      lastName: lastName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      career,
      lab: assignedLab,
      labs: assignedLab ? [assignedLab] : undefined,
      photoUrl: s3Url || DEFAULT_AVATAR,
      photoKey: s3Key || undefined,
      faceEmbeddingId: faceId || undefined,
      matchPercentage: 85,
      status: 'allowed',
      avatarInitials: initials,
      ...(selectedScheduleId ? { scheduleId: selectedScheduleId } : {}),
    };

    setRegistering(false);
    setRegistrationComplete(true);
    setTimeout(() => onComplete(student), 1200);
  };

  const hasEnteredData =
    firstName.trim().length > 0 || lastName.trim().length > 0 || career.trim().length > 0 ||
    capturedImage !== null;

  const handleCancel = () => {
    setRegistrationError('');
    if (hasEnteredData) setConfirmCancelOpen(true);
    else onCancel();
  };

  const infoValid = firstName.trim().length > 0 && career.trim().length > 0;
  const canSubmit = infoValid && capturedImage !== null && !registering;

  // Stepper del registro biométrico
  const bioSteps = [
    { id: 'camera', label: 'Cámara activa', done: useWebcam || capturedImage !== null },
    { id: 'captured', label: 'Captura completada', done: capturedImage !== null },
    { id: 'uploading', label: 'Registrando biometría', done: registering || registrationComplete, active: registering },
    { id: 'complete', label: 'Registro exitoso', done: registrationComplete },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden max-w-6xl w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" weight="fill" />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">Matriculación Biométrica</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Registro de nuevo alumno</p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" weight="bold" />
        </button>
      </div>

      {/* Cuerpo: grid 8/4 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 md:p-6">
        {/* ════════ COLUMNA IZQUIERDA (8 cols) ════════ */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {/* Card: Datos personales */}
          <section className="bg-zinc-50/60 dark:bg-zinc-800/40 rounded-2xl p-5 md:p-6 space-y-5">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
              Información personal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="en-first" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-first" type="text" required placeholder="Ej. Sofia"
                    value={firstName} onChange={e => setFirstName(e.target.value.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ' -]/g, ''))}
                    className={inputClass} />
                  <p className="mt-1 text-caption text-zinc-400 dark:text-zinc-500">Solo letras</p>
                </div>
              </div>
              <div>
                <label htmlFor="en-last" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Apellido</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-last" type="text" placeholder="Ej. Villarreal"
                    value={lastName} onChange={e => setLastName(e.target.value.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ' -]/g, ''))}
                    className={inputClass} />
                  <p className="mt-1 text-caption text-zinc-400 dark:text-zinc-500">Solo letras</p>
                </div>
              </div>
              <div>
                <label htmlFor="en-email" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Correo</label>
                <div className="relative">
                  <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-email" type="email" placeholder="alumno@uide.edu.ec"
                    value={email} onChange={e => setEmail(e.target.value)}
                    aria-invalid={!!fieldErrors.email}
                    className={`${inputClass} ${fieldErrors.email ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                </div>
                <p className="mt-1 text-caption text-zinc-400 dark:text-zinc-500">Formato: nombre@dominio.ec</p>
                {fieldErrors.email && (
                  <p className="mt-1 text-caption text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label htmlFor="en-career" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Carrera</label>
                <div className="relative">
                  <StudentIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-career" type="text" readOnly value={career}
                    className={`${inputClass} bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 cursor-not-allowed`} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="en-phone" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-phone" type="tel" placeholder="Ej. 0991234567"
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    aria-invalid={!!fieldErrors.phone}
                    className={`${inputClass} ${fieldErrors.phone ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                </div>
                <p className="mt-1 text-caption text-zinc-400 dark:text-zinc-500">Solo números (7 a 10 dígitos)</p>
                {fieldErrors.phone && (
                  <p className="mt-1 text-caption text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
                )}
              </div>
            </div>
          </section>

          {/* Card: Acceso asignado (clase, lab y horario — fijos) */}
          <section className="bg-zinc-50/60 dark:bg-zinc-800/40 rounded-2xl p-5 md:p-6 space-y-4">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
              Clase y horario asignado
            </h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              El estudiante heredará el laboratorio y el horario de la clase. Son fijos, no seleccionables.
            </p>

            {/* Selector de clase del docente (solo confirmación; lab y horario se heredan) */}
            {teacherSchedules.length > 1 && (
              <div>
                <label htmlFor="en-schedule" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Clase</label>
                <div className="relative">
                  <StudentIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <select id="en-schedule" value={selectedScheduleId} onChange={e => selectSchedule(e.target.value)}
                    className={`${inputClass} appearance-none pr-10 cursor-pointer`}>
                    {teacherSchedules.map(s => (
                      <option key={s.id} value={s.id}>{s.subject} · {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {assignedLab ? (
              <div className="rounded-2xl border border-accent-300 dark:border-accent-700 bg-accent-50 dark:bg-accent-950/30 p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-600 text-white flex items-center justify-center shrink-0">
                    <Flask className="w-5 h-5" weight="fill" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-accent-800 dark:text-accent-300">
                      {availableLabs.find(l => l.value === assignedLab)?.label || assignedLab}
                    </p>
                    <p className="text-xs text-accent-700 dark:text-accent-400">
                      Laboratorio asignado de la clase
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-caption font-bold text-accent-700 dark:text-accent-400 shrink-0">
                    <LockSimple className="w-3.5 h-3.5" weight="fill" />
                    Fijo
                  </span>
                </div>

                {scheduleInfo && (
                  <div className="pt-2.5 border-t border-accent-200 dark:border-accent-800/40 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" weight="fill" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-accent-800 dark:text-accent-300 truncate">{scheduleInfo.subject}</p>
                      <p className="text-xs text-accent-700 dark:text-accent-400">
                        {DAYS[scheduleInfo.dayOfWeek]} · {scheduleInfo.startTime}–{scheduleInfo.endTime}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-caption font-bold text-accent-700 dark:text-accent-400 shrink-0">
                      <LockSimple className="w-3.5 h-3.5" weight="fill" />
                      Fijo
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3">
                <WarningOctagon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" weight="fill" />
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                  No hay una clase asignada. El docente debe tener clases vinculadas o indicar la clase.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ════════ COLUMNA DERECHA (4 cols) — BIOMÉTRICA ════════ */}
        <div className="md:col-span-4">
          <section className="md:sticky md:top-24 bg-zinc-50/60 dark:bg-zinc-800/40 rounded-2xl p-5 md:p-6 space-y-4">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <Scan className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
              Registro biométrico
            </h4>

            {/* Viewport de captura */}
            <div className={`relative rounded-xl overflow-hidden bg-zinc-900 aspect-[4/3] flex items-center justify-center border-2 transition-all duration-300 ${
              captureSuccess ? 'border-green-500' :
              isCapturing && countdown > 0 ? 'border-accent-500' :
              capturedImage ? 'border-green-500' :
              'border-dashed border-zinc-400/40'
            }`}>
              {useWebcam ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  {showFlash && <div className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out]" />}
                  {isCapturing && countdown > 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <motion.div key={countdown} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-7xl font-black text-white">
                        {countdown}
                      </motion.div>
                    </div>
                  )}
                  {!isCapturing && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      <button onClick={startCountdown}
                        className="px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-lg">
                        <CameraIcon className="w-4 h-4" weight="fill" />
                        Capturar
                      </button>
                      <button onClick={stopWebcam}
                        className="px-4 py-2.5 bg-red-500/90 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer">
                        Detener
                      </button>
                    </div>
                  )}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-white font-mono uppercase tracking-wider">Cámara activa</span>
                  </div>
                </>
              ) : capturedImage ? (
                <div className="relative w-full h-full">
                  <img src={capturedBlobUrl || capturedImage} alt="Captura realizada" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                    <button onClick={() => { setCapturedImage(null); setCapturedBlobUrl(null); setCaptureSuccess(false); }}
                      className="px-4 py-2.5 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer">
                      Repetir captura
                    </button>
                  </div>
                  <div className="absolute top-3 right-3 w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-5 h-5 text-white" weight="fill" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-400 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                    <CameraIcon className="w-8 h-8 text-zinc-500" weight="regular" />
                  </div>
                  <span className="text-xs font-medium text-zinc-300">Activa la cámara para capturar el rostro</span>
                  <button onClick={startWebcam}
                    className="px-5 py-3 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-sm">
                    <CameraIcon className="w-4 h-4" weight="fill" />
                    Iniciar verificación
                  </button>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Stepper del registro */}
            <div className="space-y-2.5 pt-1">
              {bioSteps.map(step => (
                <div key={step.id} className={`flex items-center gap-2.5 transition-opacity duration-200 ${step.done || step.active ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.done ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                    step.active ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400' :
                    'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {step.done ? <CheckCircle className="w-3.5 h-3.5" weight="fill" /> :
                     step.active ? <CircleNotch className="w-3.5 h-3.5 animate-spin" weight="bold" /> :
                     <span>{bioSteps.indexOf(step) + 1}</span>}
                  </div>
                  <span className={`text-xs font-medium ${step.done ? 'text-green-600 dark:text-green-400' : step.active ? 'text-accent-600 dark:text-accent-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {capturedImage && (
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" weight="fill" />
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Captura lista</p>
              </div>
            )}

            {webcamError && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2.5">
                <WarningOctagon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">Verifica que los permisos de cámara estén habilitados.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer fijo */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 md:px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {registrationError && (
          <div className="w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2.5">
            <WarningOctagon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" weight="fill" />
            <p className="text-xs text-red-700 dark:text-red-400 font-medium">{registrationError}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={clearForm}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            Limpiar formulario
          </button>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
        >
          {registering ? (
            <>
              <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
              Registrando...
            </>
          ) : (
            <>
              Registrar estudiante
              <ArrowRight className="w-4 h-4" weight="bold" />
            </>
          )}
        </button>
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
