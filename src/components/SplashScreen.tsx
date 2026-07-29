import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Fingerprint } from '@phosphor-icons/react';

const LOADING_MESSAGES = [
  'Conectando con AWS Rekognition...',
  'Sincronizando base de datos biométrica...',
  'Verificando estado de kioskos...',
  'Inicializando módulo de liveness...',
  'Cargando configuración del panel...',
];

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 18;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
    }, 450);
    return () => clearInterval(interval);
  }, []);

  const clampedProgress = Math.min(progress, 100);

  return (
    <div className="fixed inset-0 bg-surface dark:bg-zinc-950 flex flex-col items-center justify-center z-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.06),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative flex flex-col items-center gap-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-accent-600 flex items-center justify-center shadow-2xl shadow-accent-500/30">
          <Fingerprint className="w-8 h-8 text-white" weight="fill" />
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            FaceAccess Lab
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sistema de control de acceso biométrico
          </p>
        </div>

        <div className="w-64 space-y-3">
          <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${clampedProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-caption text-zinc-400 dark:text-zinc-500 text-center font-mono"
          >
            {LOADING_MESSAGES[msgIndex]}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

