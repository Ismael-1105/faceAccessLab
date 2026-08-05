'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowRight, Lightning, Crosshair, Cloud,
  DeviceMobile, Cpu, Key, Database, ShieldWarning
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext.tsx';

const FEATURES = [
  { icon: Lightning, title: 'Validación en tiempo real', desc: 'Reconocimiento facial en menos de 500 ms con algoritmos optimizados en el terminal de acceso.' },
  { icon: ShieldWarning, title: 'Anti-suplantación', desc: 'Detección de vivacidad de última generación para evitar fraudes con fotografías o videos en pantalla.' },
  { icon: Cloud, title: 'Escalabilidad AWS', desc: 'Arquitectura totalmente serverless que escala automáticamente durante las horas pico del campus.' },
];

const FLOW_STEPS = [
  { num: 1, title: 'Captura', subtitle: 'Kiosco local', desc: 'El terminal captura la imagen del alumno optimizando iluminación y enfoque.', accent: 'from-accent-500 to-accent-600' },
  { num: 2, title: 'Gateway', subtitle: 'API segura', desc: 'AWS API Gateway canaliza la petición cifrada mediante TLS 1.3.', accent: 'from-zinc-600 to-zinc-700' },
  { num: 3, title: 'Lambda', subtitle: 'Serverless', desc: 'AWS Lambda orquesta el procesamiento de firmas faciales.', accent: 'from-zinc-600 to-zinc-700' },
  { num: 4, title: 'Rekognition', subtitle: 'IA biométrica', desc: 'Amazon Rekognition compara la biometría contra la base de datos.', accent: 'from-zinc-600 to-zinc-700' },
  { num: 5, title: 'MongoDB', subtitle: 'NoSQL documental', desc: 'MongoDB Atlas almacena registros y permisos del alumno.', accent: 'from-zinc-600 to-zinc-700' },
  { num: 6, title: 'Acceso', subtitle: 'Relé activado', desc: 'Un token seguro activa la cerradura electromagnética del laboratorio.', accent: 'from-accent-500 to-accent-600' },
];

export default function HomeView() {
  const { setHasCameraPermission, setShowPermissionGate } = useApp();
  const router = useRouter();
  const [selectedFlowIndex, setSelectedFlowIndex] = useState<number | null>(null);
  const [requestingCamera, setRequestingCamera] = useState(false);

  const handleAccess = async () => {
    if (requestingCamera) return;
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      stream.getTracks().forEach(track => track.stop());
      setHasCameraPermission(true);
      router.push('/kiosco');
    } catch (err) {
      console.error('[Camera] getUserMedia FALLÓ:', (err as DOMException).name, (err as DOMException).message);
      setShowPermissionGate(true);
      router.push('/kiosco');
    } finally {
      setRequestingCamera(false);
    }
  };

  return (
    <main>
      {/* HERO — 1 solo CTA principal (Hick's Law) */}
      <section className="relative min-h-[calc(100dvh-64px)] flex items-center overflow-hidden bg-surface dark:bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(37,99,235,0.06),transparent_60%)] dark:bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.12),transparent_60%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full px-6 md:px-10 py-16 md:py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">

            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-zinc-900 dark:text-white leading-[1.05] tracking-tight mt-6"
            >
              Control de acceso biométrico para el laboratorio
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }}
              className="text-base md:text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed mt-4"
            >
              Reconocimiento facial con validación cloud serverless. Grado industrial para universidades que exigen seguridad real.
            </motion.p>

            {/* ÚNICO CTA principal (Hick's Law aplicado) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <button
                onClick={handleAccess}
                disabled={requestingCamera}
                className="inline-flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-700 active:scale-[0.98] text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-accent-500/20 dark:shadow-accent-500/10 cursor-pointer disabled:opacity-60"
              >
                {requestingCamera ? 'Solicitando cámara...' : 'Acceder al laboratorio'}
                <ArrowRight className="w-5 h-5" weight="bold" />
              </button>
              <button
                onClick={() => router.push('/login')}
                className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                ¿Eres docente? Portal Docente →
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features — Bento grid */}
      <section className="py-20 md:py-24 px-6 md:px-10 bg-white dark:bg-zinc-900 border-y border-zinc-100 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-tight text-center mb-12">
            Tecnología que protege cada acceso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="group rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-8 flex flex-col gap-4 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200">
                  <div className="w-11 h-11 rounded-xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-600 dark:text-accent-400" weight="regular" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{f.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Flow Steps — Timeline no interactiva (eliminado Hick's Law de 6 clicks) */}
      <section className="py-20 md:py-24 px-6 md:px-10 bg-surface dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-tight text-center mb-12">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FLOW_STEPS.map((step) => (
              <div key={step.num} className="flex gap-3 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="w-8 h-8 rounded-xl bg-accent-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {step.num}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{step.title}</h4>
                  <p className="text-caption text-zinc-500 dark:text-zinc-400 font-mono uppercase">{step.subtitle}</p>
                  <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — demo context */}
      <section className="py-12 px-6 md:px-10 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Proyecto académico · Demostración funcional de control de acceso biométrico
          </p>
          <p className="text-caption text-zinc-300 dark:text-zinc-600 mt-1">
            FaceAccess Lab · Universidad Internacional del Ecuador (UIDE)
          </p>
        </div>
      </section>
    </main>
  );
}

