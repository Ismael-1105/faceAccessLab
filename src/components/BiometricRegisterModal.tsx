'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, Camera as CameraIcon, CheckCircle, Fingerprint, WarningOctagon,
  CircleNotch, Scan,
} from '@phosphor-icons/react';
import type { Student } from '../types.ts';
import { api } from '../lib/api.ts';

interface BiometricRegisterModalProps {
  student: Student;
  onClose: () => void;
  onRegistered: (student: Student) => void;
}

export default function BiometricRegisterModal({ student, onClose, onRegistered }: BiometricRegisterModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [useWebcam, setUseWebcam] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [webcamError, setWebcamError] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl);
    };
  }, [capturedBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.onloadedmetadata = () => video.play().catch(() => {});
    return () => { video.srcObject = null; };
  }, [useWebcam]);

  const startWebcam = async () => {
    try {
      setWebcamError(false);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = s;
      setUseWebcam(true);
    } catch (err) {
      console.error('[Biometric] Error webcam:', err);
      setUseWebcam(false);
      setWebcamError(true);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
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

  const handleSubmit = async () => {
    if (!capturedImage) return;
    setRegistering(true);
    setError('');
    try {
      const res = await api.registerBiometric({
        studentId: student.id,
        imageBase64: capturedImage,
      });
      setDone(true);
      setTimeout(() => onRegistered(res.student), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar la biometría');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !registering && !done && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-white" weight="fill" />
              </div>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">Registrar biometría</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{student.name}</p>
              </div>
            </div>
            <button
              onClick={() => !registering && !done && onClose()}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" weight="bold" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-green-600 dark:text-green-400" weight="fill" />
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Biometría registrada</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">El estudiante ya puede acceder por el kiosco.</p>
            </div>
          ) : (
            <>
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
                    <img src={capturedBlobUrl || capturedImage} alt="Captura" className="w-full h-full object-cover" />
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
                      Iniciar cámara
                    </button>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {webcamError && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2.5">
                  <WarningOctagon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" weight="fill" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">Verifica que los permisos de cámara estén habilitados.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2.5">
                  <WarningOctagon className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" weight="fill" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-2.5">
                <button onClick={onClose} disabled={registering}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 transition-all cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleSubmit} disabled={!capturedImage || registering}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent-600 hover:bg-accent-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
                  {registering ? <CircleNotch className="w-4 h-4 animate-spin" weight="bold" /> : <Scan className="w-4 h-4" weight="bold" />}
                  {registering ? 'Registrando...' : 'Registrar biometría'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
