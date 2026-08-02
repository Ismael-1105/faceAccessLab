import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, User, Student as StudentIcon, Flask, Camera as CameraIcon, CheckCircle,
  ArrowRight, Image as ImageIcon, Scan, Fingerprint, WarningOctagon,
  IdentificationBadge, Envelope, Phone, ShieldCheck, CircleNotch, CaretDown
} from '@phosphor-icons/react';
import type { Student, Career } from '../types.ts';
import { CAREERS } from '../types.ts';
import { api, getToken } from '../lib/api.ts';
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
}

const FALLBACK_LABS = [
  { value: 'LAB-02', label: 'LAB-02 (Sistemas Operativos)', desc: 'Laboratorio de sistemas operativos' },
];

const DEFAULT_AVATAR = '/images/default-avatar.jpg';

const inputClass =
  'w-full text-xs p-3 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all';

export default function EnrollmentView({ onComplete, onCancel }: EnrollmentViewProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [email, setEmail] = useState('');
  const [career, setCareer] = useState<Career | ''>('');
  const [phone, setPhone] = useState('');
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);

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
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; documentId?: string; phone?: string }>({});
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
  }, []);

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

  const toggleLab = (lab: string) => {
    setSelectedLabs(prev =>
      prev.includes(lab) ? prev.filter(l => l !== lab) : [...prev, lab],
    );
  };

  const clearForm = () => {
    setFirstName('');
    setLastName('');
    setDocumentId('');
    setEmail('');
    setCareer('');
    setPhone('');
    setSelectedLabs([]);
    setCapturedImage(null);
    setCapturedBlobUrl(null);
    setCaptureSuccess(false);
    setRegistrationError('');
    setFieldErrors({});
    stopWebcam();
  };

  const validateFields = () => {
    const errors: { email?: string; documentId?: string; phone?: string } = {};
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errors.email = 'Ingresa un correo válido (ej. alumno@uide.edu.ec)';
    }
    if (documentId.trim() && !/^\d{6,10}$/.test(documentId.trim())) {
      errors.documentId = 'La cédula debe contener entre 6 y 10 dígitos';
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
      documentId: documentId.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      career,
      lab: selectedLabs[0] || 'LAB-02',
      labs: selectedLabs,
      photoUrl: s3Url || DEFAULT_AVATAR,
      photoKey: s3Key || undefined,
      faceEmbeddingId: faceId || undefined,
      matchPercentage: 85,
      status: 'allowed',
      avatarInitials: initials,
    };

    setRegistering(false);
    setRegistrationComplete(true);
    setTimeout(() => onComplete(student), 1200);
  };

  const hasEnteredData =
    firstName.trim().length > 0 || lastName.trim().length > 0 || career.trim().length > 0 ||
    capturedImage !== null || selectedLabs.length > 0;

  const handleCancel = () => {
    setRegistrationError('');
    if (hasEnteredData) setConfirmCancelOpen(true);
    else onCancel();
  };

  const infoValid = firstName.trim().length > 0 && career.trim().length > 0;
  const canSubmit = infoValid && selectedLabs.length > 0 && capturedImage !== null && !registering;

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
                    value={firstName} onChange={e => setFirstName(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="en-last" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Apellido</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-last" type="text" placeholder="Ej. Villarreal"
                    value={lastName} onChange={e => setLastName(e.target.value)}
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="en-doc" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">ID / Cédula</label>
                <div className="relative">
                  <IdentificationBadge className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-doc" type="text" placeholder="Ej. 1723456789"
                    value={documentId} onChange={e => setDocumentId(e.target.value)}
                    aria-invalid={!!fieldErrors.documentId}
                    className={`${inputClass} ${fieldErrors.documentId ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                </div>
                {fieldErrors.documentId && (
                  <p className="mt-1 text-caption text-red-600 dark:text-red-400">{fieldErrors.documentId}</p>
                )}
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
                {fieldErrors.email && (
                  <p className="mt-1 text-caption text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label htmlFor="en-career" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Carrera</label>
                <div className="relative">
                  <StudentIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <select
                    id="en-career"
                    required
                    value={career}
                    onChange={e => setCareer(e.target.value as Career)}
                    className={`${inputClass} appearance-none pr-10 cursor-pointer`}
                  >
                    <option value="" disabled>Selecciona una carrera</option>
                    {CAREERS.map(c => (
                      <option key={c.value} value={c.value}>{c.value}</option>
                    ))}
                  </select>
                  <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="bold" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="en-phone" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                  <input id="en-phone" type="tel" placeholder="Ej. 0991234567"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    aria-invalid={!!fieldErrors.phone}
                    className={`${inputClass} ${fieldErrors.phone ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} />
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-caption text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
                )}
              </div>
            </div>
          </section>

          {/* Card: Permisos */}
          <section className="bg-zinc-50/60 dark:bg-zinc-800/40 rounded-2xl p-5 md:p-6 space-y-4">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent-500 dark:text-accent-400" weight="fill" />
              Permisos de laboratorio
            </h4>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Selecciona los laboratorios a los que tendrá acceso el alumno.
            </p>
            <div className="space-y-3">
              {availableLabs.map(lab => {
                const active = selectedLabs.includes(lab.value);
                return (
                  <button
                    key={lab.value}
                    onClick={() => toggleLab(lab.value)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer group ${
                      active
                        ? 'bg-accent-50 dark:bg-accent-950/30 border-accent-300 dark:border-accent-700'
                        : 'bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-accent-300 dark:hover:border-accent-700'
                    }`}
                    role="switch"
                    aria-checked={active}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? 'bg-accent-600 text-white' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                    }`}>
                      <Flask className="w-4 h-4" weight={active ? 'fill' : 'regular'} />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{lab.label}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{lab.desc}</p>
                    </div>
                    {/* Switch */}
                    <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                      active ? 'bg-accent-600' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        active ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </span>
                  </button>
                );
              })}
            </div>
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
