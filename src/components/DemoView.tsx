/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera, FilmSlate, ArrowsClockwise, XCircle, CheckCircle,
  Lock, LockOpen, Printer, Question, ClockCounterClockwise,
  Info, WarningOctagon
} from '@phosphor-icons/react';
import { Student, AccessLog } from '../types.ts';
import { INITIAL_STUDENTS } from '../data.ts';
import { useApp } from '../context/AppContext.tsx';
import CameraPermissionGate from './CameraPermissionGate.tsx';

export default function DemoView() {
  const { students: appStudents, handleAddLog, handleIncrementStats } = useApp();
  const [flowState, setFlowState] = useState<'idle' | 'scanning' | 'processing' | 'result'>('idle');
  const [selectedStudent, setSelectedStudent] = useState<Student>(INITIAL_STUDENTS[0]);
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [cameraPermissionChecked, setCameraPermissionChecked] = useState(false);
  const [showDemoPermissionGate, setShowDemoPermissionGate] = useState(false);

  const [globalProgress, setGlobalProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [simulatedMatchPct, setSimulatedMatchPct] = useState(99.8);
  const [lockCountdown, setLockCountdown] = useState(10);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedStudentRef = useRef(selectedStudent);
  const simulatedMatchPctRef = useRef(simulatedMatchPct);
  const handleAddLogRef = useRef(handleAddLog);
  const handleIncrementStatsRef = useRef(handleIncrementStats);

  useEffect(() => {
    selectedStudentRef.current = selectedStudent;
    simulatedMatchPctRef.current = simulatedMatchPct;
    handleAddLogRef.current = handleAddLog;
    handleIncrementStatsRef.current = handleIncrementStats;
  }, [selectedStudent, simulatedMatchPct, handleAddLog, handleIncrementStats]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      stopWebcam();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setWebcamActive(true);
    } catch {
      setUseWebcam(false);
      setWebcamActive(false);
    }
  }, [stopWebcam]);

  const setSelectedFlowPoints = useCallback(() => {
    if (selectedStudent) {
      if (selectedStudent.status === 'denied') {
        setSimulatedMatchPct(22.8);
      } else {
        const dev = parseFloat((Math.random() * 0.9).toFixed(1));
        setSimulatedMatchPct(parseFloat((selectedStudent.matchPercentage - dev).toFixed(1)));
      }
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (useWebcam && flowState === 'scanning') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => { stopWebcam(); };
  }, [useWebcam, flowState, startWebcam, stopWebcam]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (flowState === 'scanning') {
      setSelectedFlowPoints();
      timer = setTimeout(() => {
        setFlowState('processing');
        setGlobalProgress(25);
        setCurrentStepIndex(0);
      }, 2200);
    } else if (flowState === 'processing') {
      const interval = setInterval(() => {
        setGlobalProgress(prev => {
          const nextVal = prev + Math.floor(Math.random() * 6) + 3;
          if (nextVal >= 100) {
            clearInterval(interval);
            setFlowState('result');
            setLockCountdown(10);

            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const h = pad(now.getHours());
            const m = pad(now.getMinutes());
            const s = pad(now.getSeconds());

            const isAllowed = selectedStudentRef.current.status === 'allowed';
            const similarityScore = isAllowed ? simulatedMatchPctRef.current : 22.8;

            const newLog: AccessLog = {
              id: 'log-' + Math.random().toString(36).substr(2, 9),
              studentId: selectedStudentRef.current.id,
              studentName: isAllowed ? selectedStudentRef.current.name : 'Persona Desconocida',
              avatarInitials: selectedStudentRef.current.avatarInitials,
              date: 'Oct 24, 2024',
              time: `${h}:${m}:${s}`,
              result: isAllowed ? 'Permitido' : 'Denegado',
              similarity: parseFloat(similarityScore.toFixed(1))
            };

            handleAddLogRef.current(newLog);
            handleIncrementStatsRef.current(isAllowed);
            stopWebcam();
            return 100;
          }
          if (nextVal >= 80) setCurrentStepIndex(3);
          else if (nextVal >= 60) setCurrentStepIndex(2);
          else if (nextVal >= 40) setCurrentStepIndex(1);
          return nextVal;
        });
      }, 180);
      return () => clearInterval(interval);
    }
    return () => clearTimeout(timer);
  }, [flowState, setSelectedFlowPoints, stopWebcam]);

  useEffect(() => {
    let countdownTimer: ReturnType<typeof setTimeout>;
    if (flowState === 'result' && lockCountdown > 0) {
      countdownTimer = setTimeout(() => { setLockCountdown(prev => prev - 1); }, 1000);
    }
    return () => clearTimeout(countdownTimer);
  }, [flowState, lockCountdown]);

  const handlePrintReceipt = () => {
    const text = `
=============================================
        COMPROBANTE DE ENTRADA - FACEACCESS LAB
=============================================
Dispositivo: Terminal Kiosk #042
Ubicacion: Edificio de Computacion, Lab-02
Servidor Cloud: AWS Virginia (us-east-1)
Fecha: Oct 24, 2024
Resultados:
  - Estudiante: ${selectedStudent.name}
  - Especialidad: ${selectedStudent.career}
  - Coincidencia Biometrica: ${selectedStudent.status === 'allowed' ? simulatedMatchPct : '22.8'}%
  - Estado Cerradura: DESBLOQUEADA
=============================================
MANTENGA LA SEGURIDAD DEL CAMPUS EN TODO MOMENTO!
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FaceAccess_Recibo_${selectedStudent.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (showDemoPermissionGate) {
    return (
      <CameraPermissionGate
        onProceed={() => {
          setShowDemoPermissionGate(false);
          setCameraPermissionChecked(true);
          setUseWebcam(true);
          setFlowState('scanning');
          setGlobalProgress(0);
        }}
        onCancel={() => setShowDemoPermissionGate(false)}
      />
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-surface dark:bg-zinc-950 flex flex-col">
      {/* Selector bar */}
      <section className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-3 px-5 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <p className="text-label font-mono tracking-wider uppercase text-zinc-400 dark:text-zinc-500 font-semibold">Control de simulación</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">Selecciona un perfil para simular el escaneo:</p>
        </div>
        <select
          value={selectedStudent.id}
          onChange={(e) => {
            const student = INITIAL_STUDENTS.find(s => s.id === e.target.value);
            if (student) { setSelectedStudent(student); setFlowState('idle'); }
          }}
          disabled={flowState === 'scanning' || flowState === 'processing'}
          className="px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all disabled:opacity-40 min-w-[200px]"
        >
          {INITIAL_STUDENTS.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}{student.id === 'student-unknown' ? ' (Intruso)' : ''} — {student.matchPercentage}%
            </option>
          ))}
        </select>
      </section>

      {/* Main terminal */}
      <main className="flex-grow flex items-center justify-center p-5 md:p-8">
        <h1 className="sr-only">Demostración de Escaneo Biométrico</h1>
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-stretch">

          {/* LEFT: Camera view */}
          <div className="md:col-span-7 flex flex-col">
            <div className="relative bg-zinc-900 rounded-2xl overflow-hidden flex-1 min-h-[360px] md:min-h-[440px] border border-zinc-800 shadow-xl flex flex-col justify-between">
              <div className="absolute inset-0 z-0">
                {flowState === 'idle' ? (
                  <div className="w-full h-full relative">
                    <img
                      className="w-full h-full object-cover opacity-40 filter blur-[1px]"
                      alt="Feed de cámara del pasillo del laboratorio"
                      src="/images/camera-feed-bg.jpg"
                      onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                    />
                    <div className="absolute inset-0 bg-accent-950/10 mix-blend-color" />
                  </div>
                ) : useWebcam && webcamActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1] opacity-70 cursor-crosshair"
                    aria-label="Feed de cámara en vivo del kiosco"
                  />
) : (
                  <div className="w-full h-full relative cursor-crosshair">
                    <img
                      className="w-full h-full object-cover opacity-40 filter blur-[1px]"
                      alt="Feed de cámara del pasillo del laboratorio"
                      src="/images/camera-feed-bg.jpg"
                      onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                    />
                    <div className="absolute inset-0 bg-accent-950/10 mix-blend-color" />
                  </div>
                )}
              </div>

              {/* HUD overlays */}
              <div className="relative z-10 p-5 flex flex-col justify-between h-full pointer-events-none">
                <div className="flex justify-between items-start">
                  <span className="bg-zinc-950/90 text-white text-micro font-mono tracking-widest px-2.5 py-1 rounded-lg uppercase backdrop-blur">
                    Feed en Vivo // 001
                  </span>
                </div>

                {(flowState === 'scanning' || flowState === 'processing') && (
                  <div className="self-center relative w-48 h-56 rounded-xl flex items-center justify-center">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl" />
                    <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr" />
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br" />
                    <img
                      src="/images/scan-demo-profile.jpg"
                      alt="Escaneo facial"
                      className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-60"
                      onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                    />
                  </div>
                )}

                <div className="flex justify-between items-end">
                  <div className="bg-zinc-950/95 px-4 py-1.5 rounded-lg flex items-center gap-2 backdrop-blur">
<span className={`w-2 h-2 rounded-full ${flowState !== 'idle' ? 'bg-accent-400 animate-pulse' : 'bg-green-500'}`} aria-hidden="true" />
                    <span className="text-white text-label tracking-wider font-mono uppercase">
                      {flowState === 'idle' && 'SENSOR BIOMÉTRICO LISTO'}
                      {flowState === 'scanning' && 'ESCANER PREPARADO'}
                      {flowState === 'processing' && 'EXTRAYENDO ATRIBUTOS...'}
                      {flowState === 'result' && 'PROCESAMIENTO COMPLETADO'}
                    </span>
                  </div>
                  {flowState === 'processing' && (
                    <div className="bg-zinc-950/90 px-3 py-1.5 rounded-lg backdrop-blur">
                      <span className="text-micro text-zinc-400 uppercase font-mono tracking-wider">Similitud:</span>
                      <p className="text-xs text-green-400 font-mono font-bold">
                        {selectedStudent.status === 'allowed' ? simulatedMatchPct : '22.8'}% de coincidencia
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Status panel */}
          <div className="md:col-span-5 flex flex-col gap-5">
            {flowState !== 'result' ? (
              <div className="flex flex-col gap-5 h-full justify-between">
                <div>
                  <span className="text-label font-mono tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg uppercase font-semibold inline-block">
                    Estado de verificacion
                  </span>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mt-3">
                    {flowState === 'idle' ? 'Inicio de Lectura' : 'Procesando Biometria'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1.5">
                    Asegurese de mirar directamente a la camara. La imagen no se guarda en discos publicos.
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex-grow flex flex-col justify-center gap-4" role="list">
                  {/* Step 1 */}
                  <div className={`flex gap-3 items-start ${flowState === 'idle' ? 'opacity-30' : ''}`} role="listitem">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-caption font-bold ${
                        flowState === 'scanning' ? 'bg-accent-600 text-white border-accent-600 animate-spin' :
                        flowState === 'processing' && globalProgress > 25 ? 'bg-green-600 text-white border-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {flowState === 'processing' && globalProgress > 25 ? '\u2713' : '1'}
                      </div>
                      <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700 mt-1" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Detectando rostro</h4>
                      <p className="text-label text-zinc-400 mt-0.5">
                        {flowState === 'idle' && 'Esperando inicio...'}
                        {flowState === 'scanning' && 'En progreso...'}
                        {flowState === 'processing' && globalProgress <= 25 && 'Buscando orbita ocular...'}
                        {flowState === 'processing' && globalProgress > 25 && 'Rostro localizado.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`flex gap-3 items-start ${globalProgress < 40 ? 'opacity-30' : ''}`} role="listitem">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-caption font-bold ${
                        flowState === 'processing' && currentStepIndex === 1 ? 'bg-accent-600 text-white border-accent-600' :
                        flowState === 'processing' && globalProgress > 53 ? 'bg-green-600 text-white border-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {globalProgress > 53 ? '\u2713' : '2'}
                      </div>
                      <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700 mt-1" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Deteccion de vivacidad</h4>
                      <p className="text-label text-zinc-400 mt-0.5">
                        {globalProgress < 40 && 'Esperando...'}
                        {flowState === 'processing' && currentStepIndex === 1 && 'Examinando micro-reflejos...'}
                        {globalProgress > 53 && 'Sujeto vivo verificado.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className={`flex gap-3 items-start ${globalProgress < 60 ? 'opacity-30' : ''}`} role="listitem">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-caption font-bold ${
                        flowState === 'processing' && currentStepIndex === 2 ? 'bg-accent-600 text-white border-accent-600' :
                        flowState === 'processing' && globalProgress > 78 ? 'bg-green-600 text-white border-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {globalProgress > 78 ? '\u2713' : '3'}
                      </div>
                      <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700 mt-1" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Comparacion biometrica</h4>
                      <p className="text-label text-zinc-400 mt-0.5">
                        {globalProgress < 60 && 'Esperando...'}
                        {flowState === 'processing' && currentStepIndex === 2 && 'Mapeando rasgos faciales...'}
                        {globalProgress > 78 && 'Base de datos contrastada.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className={`flex gap-3 items-start ${globalProgress < 80 ? 'opacity-30' : ''}`} role="listitem">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-caption font-bold ${
                        flowState === 'processing' && currentStepIndex === 3 ? 'bg-accent-600 text-white border-accent-600' :
                        globalProgress >= 100 ? 'bg-green-600 text-white border-green-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {globalProgress >= 100 ? '\u2713' : '4'}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Permisos y horarios</h4>
                      <p className="text-label text-zinc-400 mt-0.5">
                        {globalProgress < 80 && 'Esperando...'}
                        {flowState === 'processing' && currentStepIndex === 3 && 'Validando credencial...'}
                        {globalProgress >= 100 && 'Permiso academico concedido.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress bar + controls */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-label font-bold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase font-mono">Progreso</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">{globalProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-600 transition-all duration-150 ease-out rounded-full"
                      style={{ width: `${globalProgress}%` }}
                    />
                  </div>
                  <div className="mt-4 flex gap-3 justify-end">
                    {flowState === 'idle' && (
                      <button
                        onClick={() => setUseWebcam(!useWebcam)}
                        className={`text-xs py-2.5 px-3.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          useWebcam
                            ? 'bg-accent-50 dark:bg-accent-950/30 border-accent-200 dark:border-accent-800 text-accent-700 dark:text-accent-300'
                            : 'bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" weight="regular" />
                        {useWebcam ? 'Usar imagen fija' : 'Webcam'}
                      </button>
                    )}
                    {flowState === 'idle' ? (
                      <button
                        onClick={() => {
                          if (useWebcam && !cameraPermissionChecked) {
                            setShowDemoPermissionGate(true);
                          } else {
                            setFlowState('scanning');
                            setGlobalProgress(0);
                          }
                        }}
                        className="bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 px-6 rounded-lg text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer"
                      >
                        Iniciar Escaneo
                      </button>
                    ) : (
                      <button
                        onClick={() => { stopWebcam(); setFlowState('idle'); setGlobalProgress(0); setCurrentStepIndex(0); }}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer"
                      >
                        Abortar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Result card */
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full justify-between">
                {selectedStudent.status === 'allowed' ? (
                  <div className="bg-green-600 text-white px-5 py-6 text-center select-none">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-white" weight="fill" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Acceso Concedido</h3>
                    <p className="text-caption opacity-80 mt-1 uppercase tracking-widest font-mono">Identidad Verificada</p>
                  </div>
                ) : (
                  <div className="bg-red-600 text-white px-5 py-6 text-center select-none">
                    <div className="w-14 h-14 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-3">
                      <WarningOctagon className="w-8 h-8 text-white" weight="fill" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Acceso Denegado</h3>
                    <p className="text-caption opacity-80 mt-1 uppercase tracking-widest font-mono">Rostro No Identificado</p>
                  </div>
                )}

                <div className="p-5 flex-grow flex flex-col justify-center">
                  <div className="flex flex-col sm:flex-row items-center gap-5 justify-between">
                    <div className="flex flex-col items-center">
                      <div className={`w-28 h-28 rounded-xl border-2 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative ${selectedStudent.status === 'allowed' ? 'border-green-500' : 'border-red-500'}`}>
                        <img
                          className="w-full h-full object-cover"
                          alt={selectedStudent.name}
                          src={selectedStudent.photoUrl}
                          onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                        />
                        <span className="absolute text-4xl font-bold text-zinc-400 dark:text-zinc-500">{selectedStudent.avatarInitials}</span>
                      </div>
                      <span className={`mt-2.5 px-3 py-1 rounded-lg text-label font-bold uppercase tracking-wider ${
                        selectedStudent.status === 'allowed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                      }`}>
                        Match: {selectedStudent.status === 'allowed' ? simulatedMatchPct : '22.8'}%
                      </span>
                    </div>

                    <div className="flex-grow text-left space-y-4 pl-0 sm:pl-4">
                      <div>
                        <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Estudiante</span>
                        <p className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">{selectedStudent.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Carrera</span>
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{selectedStudent.career}</p>
                        </div>
                        <div>
                          <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Laboratorio</span>
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{selectedStudent.lab}</p>
                        </div>
                      </div>

                      <div className="pt-5 mt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectedStudent.status === 'allowed' ? (
                            <>
                              <LockOpen className="w-5 h-5 text-green-600 dark:text-green-400" weight="fill" />
                              <div>
                                <span className="text-micro text-zinc-400 dark:text-zinc-500 tracking-wider font-mono uppercase font-bold block">Perno</span>
                                <span className="text-xs font-bold text-green-700 dark:text-green-400">Desbloqueado</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <Lock className="w-5 h-5 text-red-600 dark:text-red-400" weight="fill" />
                              <div>
                                <span className="text-micro text-zinc-400 dark:text-zinc-500 tracking-wider font-mono uppercase font-bold block">Perno</span>
                                <span className="text-xs font-bold text-red-700 dark:text-red-400">Bloqueado</span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
<span className={`w-2 h-2 rounded-full ${selectedStudent.status === 'allowed' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
                          <span className="text-micro font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Sistema Activo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 px-5 py-3.5 flex justify-between items-center gap-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" weight="regular" />
                    Bajar Recibo
                  </button>
                  <button
                    onClick={() => { setFlowState('idle'); setGlobalProgress(0); setCurrentStepIndex(0); }}
                    className="bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 px-5 text-xs uppercase tracking-wider rounded-lg active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Nuevo Escaneo
                  </button>
                </div>

                {selectedStudent.status === 'allowed' && (
                  <div className="bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-400 py-2 px-4 text-center text-label font-mono font-medium">
                    La cerradura se bloqueara automaticamente en {lockCountdown} segundos.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

