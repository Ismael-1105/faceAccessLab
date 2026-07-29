import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Fingerprint, CheckCircle, XCircle, SignIn } from '@phosphor-icons/react';
import { Student, AccessLog } from '../types.ts';

interface StudentProfileProps {
  student: Student;
  logs: AccessLog[];
  onBack: () => void;
  onBackToLanding: () => void;
}

export default function StudentProfile({ student, logs, onBack }: StudentProfileProps) {
  const navigate = useNavigate();
  const latestLog = logs[0];
  const totalAccesses = logs.length;
  const granted = logs.filter(l => l.result === 'Permitido').length;
  const denied = logs.filter(l => l.result === 'Denegado').length;

  return (
    <div className="min-h-screen bg-surface dark:bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all cursor-pointer"
          aria-label="Volver al kiosco"
        >
          <ArrowLeft className="w-4 h-4" weight="regular" />
          Volver al Kiosco
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-600 flex items-center justify-center">
            <Fingerprint className="w-3.5 h-3.5 text-white" weight="fill" />
          </div>
          <span className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">FaceAccess</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all cursor-pointer"
          aria-label="Salir del perfil"
        >
          Salir
        </button>
      </div>

      <main className="flex-grow flex items-center justify-center p-5 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          {/* Student card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Header photo area */}
            <div className="bg-gradient-to-br from-accent-600 to-accent-800 px-6 pt-8 pb-6 text-center relative">
              <div className="w-24 h-24 rounded-2xl border-4 border-white/30 overflow-hidden bg-zinc-200 dark:bg-zinc-700 mx-auto shadow-xl flex items-center justify-center relative">
                <img
                  className="w-full h-full object-cover"
                  alt={student.name}
                  src={student.photoUrl}
                  onError={(e) => { e.currentTarget.src = '/images/camera-feed-bg.jpg'; }}
                />
                <span className="absolute text-3xl font-bold text-zinc-400">{student.avatarInitials}</span>
              </div>
              <h1 className="text-xl font-black text-white mt-4 tracking-tight">{student.name}</h1>
              <p className="text-sm text-white/70 mt-0.5">{student.career}</p>
            </div>

            {/* Info */}
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                  <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Laboratorio</span>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{student.lab}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                  <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Coincidencia</span>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{student.matchPercentage}%</p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase">Estado de Acceso</span>
                  <p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {student.status === 'allowed' ? 'Habilitado' : 'Suspendido'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  student.status === 'allowed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {student.status === 'allowed'
                    ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" weight="fill" />
                    : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" weight="fill" />
                  }
                </div>
              </div>

              {/* Mini-dashboard */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase mb-3">Dashboard de Accesos</span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-950/30 flex items-center justify-center mx-auto mb-1.5">
                      <SignIn className="w-4 h-4 text-accent-600 dark:text-accent-400" weight="regular" />
                    </div>
                    <p className="text-lg font-black text-zinc-900 dark:text-white font-mono">{totalAccesses}</p>
                    <p className="text-micro font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-1.5">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" weight="regular" />
                    </div>
                    <p className="text-lg font-black text-zinc-900 dark:text-white font-mono">{granted}</p>
                    <p className="text-micro font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Permitidos</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 text-center">
                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-1.5">
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" weight="regular" />
                    </div>
                    <p className="text-lg font-black text-zinc-900 dark:text-white font-mono">{denied}</p>
                    <p className="text-micro font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Denegados</p>
                  </div>
                </div>
              </div>

              {/* Latest access */}
              {latestLog && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
                  <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase mb-3">Ultimo Acceso</span>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">{latestLog.date} — {latestLog.time}</p>
                      <span className="text-label font-mono text-zinc-400 dark:text-zinc-500 mt-0.5 block">{latestLog.similarity}% similitud</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-label font-bold ${
                      latestLog.result === 'Permitido'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                    }`}>
                      {latestLog.result}
                    </span>
                  </div>
                </div>
              )}

              {/* Access history */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <span className="text-micro font-mono tracking-wider text-zinc-400 dark:text-zinc-500 block font-bold uppercase mb-3">
                  Historial de Accesos ({logs.length})
                </span>
                {logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{log.date}</p>
                          <span className="text-label font-mono text-zinc-400 dark:text-zinc-500">{log.time}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-zinc-400 dark:text-zinc-500 text-label">{log.similarity}%</span>
                          <span className={`px-2 py-0.5 rounded-lg text-micro font-bold ${
                            log.result === 'Permitido'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }`}>
                            {log.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
                    No hay accesos registrados aún. Realiza un escaneo desde el kiosco.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

