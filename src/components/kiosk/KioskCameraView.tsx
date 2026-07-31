'use client';

import { Check, X, Camera as CameraIcon, Loader2, ScanFace } from 'lucide-react';
import type { FlowState } from '@/src/hooks/useKioskFlow';
import FaceLivenessView from '@/src/components/FaceLivenessView';

interface KioskCameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  flowState: FlowState;
  statusMessage: string;
  scanBlocked: boolean;
  livenessSessionId: string | null;
  cameras: MediaDeviceInfo[];
  selectedCamera: string;
  showSettings: boolean;
  isScanning: boolean;
  isSuccess: boolean;
  isError: boolean;
  showFaceGuide: boolean;
  startLiveness: () => void;
  toggleSettings: () => void;
  switchCamera: (deviceId: string) => void;
  toggleScanBlocked: () => void;
  resetScan: () => void;
  onLivenessSuccess: (confidence: number) => void;
  onLivenessFail: (message: string) => void;
}

export default function KioskCameraView({
  videoRef,
  flowState,
  statusMessage,
  scanBlocked,
  livenessSessionId,
  cameras,
  selectedCamera,
  showSettings,
  isScanning,
  isSuccess,
  isError,
  showFaceGuide,
  startLiveness,
  toggleSettings,
  switchCamera,
  toggleScanBlocked,
  resetScan,
  onLivenessSuccess,
  onLivenessFail,
}: KioskCameraViewProps) {
  const cameraLoading = !videoRef.current || videoRef.current.readyState < 2;

  return (
    <section className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 animate-kiosk-fade-in">
      {/* Viewport de cámara */}
      <div className="relative bg-black rounded-[20px] overflow-hidden aspect-[1.7/1.4] shadow-xl shadow-zinc-900/10 dark:shadow-black/40 border border-zinc-200/60 dark:border-zinc-800">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {/* Fondo negro mientras carga */}
        {cameraLoading && flowState !== 'liveness' && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        )}

        {/* ══ MÁSCARA DE GUÍA BIOMÉTRICA (overlay, NO recorta el video) ══ */}
        {showFaceGuide && (
          <svg
            className="biometric-mask"
            viewBox="0 0 100 56.25"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <mask id="face-guide-mask">
                <rect width="100" height="56.25" fill="white" />
                <ellipse cx="50" cy="28" rx="22.5" ry="18.3" fill="black" />
              </mask>
            </defs>
            <rect width="100" height="56.25" fill="rgba(0,0,0,0.28)" mask="url(#face-guide-mask)" />
            <ellipse
              className="mask-ellipse"
              cx="50"
              cy="28"
              rx="22.5"
              ry="18.3"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="0.55"
            />
          </svg>
        )}

        {/* ══ ESQUINA SUPERIOR IZQUIERDA: EN VIVO ══ */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-black/45 backdrop-blur-md rounded-xl">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-white">En vivo</span>
        </div>

        {/* ══ ESQUINA SUPERIOR DERECHA: CÁMARA + CERRAR ══ */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={toggleSettings}
            className="w-10 h-10 min-h-11 rounded-xl bg-black/45 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
            aria-label="Configuración de cámara"
          >
            <CameraIcon className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={resetScan}
            className="w-10 h-10 min-h-11 rounded-xl bg-black/45 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* ══ MENSAJES (con aria-live, no tapan el rostro) ══ */}
        {(flowState === 'idle' || isScanning) && (
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-3 bg-black/60 backdrop-blur-md rounded-xl text-center animate-kiosk-message"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-white whitespace-nowrap">{statusMessage}</p>
            <p className="text-[11px] text-zinc-300 mt-0.5">
              {flowState === 'idle'
                ? (scanBlocked ? 'Pausado' : 'Detección automática activa')
                : 'Mantén la cabeza dentro del óvalo'}
            </p>
          </div>
        )}

        {/* ══ MENÚ DE CÁMARA ══ */}
        {showSettings && (
          <div className="absolute top-14 right-4 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-3 z-20 animate-kiosk-scale-in">
            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2 py-1">Cámara</p>
            <div className="space-y-1 max-h-44 overflow-auto">
              {cameras.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 px-2 py-2">Sin cámaras detectadas</p>
              )}
              {cameras.map((cam, i) => (
                <button
                  key={cam.deviceId || i}
                  onClick={() => switchCamera(cam.deviceId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                    selectedCamera === cam.deviceId || (!selectedCamera && i === 0)
                      ? 'bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-300'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <CameraIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{cam.label || `Cámara ${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ RESULTADO: indicador compacto sin tapar el rostro ══ */}
        {isSuccess && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 bg-green-600 rounded-2xl shadow-2xl animate-kiosk-scale-in"
            role="status"
            aria-live="assertive"
          >
            <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
            <p className="text-sm font-black text-white uppercase tracking-wide">Acceso concedido</p>
          </div>
        )}

        {isError && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 bg-red-600 rounded-2xl shadow-2xl animate-kiosk-scale-in"
            role="status"
            aria-live="assertive"
          >
            <X className="w-6 h-6 text-white" strokeWidth={2.5} />
            <p className="text-sm font-black text-white uppercase tracking-wide">Acceso denegado</p>
          </div>
        )}

        {/* ══ OVERLAY FACE LIVENESS ══ */}
        {flowState === 'liveness' && livenessSessionId && (
          <div className="absolute inset-0 animate-kiosk-fade-in">
            <FaceLivenessView
              sessionId={livenessSessionId}
              onSuccess={onLivenessSuccess}
              onFail={onLivenessFail}
            />
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        {flowState === 'idle' && !scanBlocked && (
          <button
            onClick={startLiveness}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 min-h-14 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-accent-600/20"
          >
            <ScanFace className="w-5 h-5" />
            Iniciar verificación
          </button>
        )}
        {flowState === 'idle' && (
          <button
            onClick={toggleScanBlocked}
            className={`px-6 py-4 min-h-14 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
              scanBlocked
                ? 'bg-accent-600 text-white'
                : 'bg-white dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {scanBlocked ? 'Reanudar' : 'Pausar'}
          </button>
        )}
        {isScanning && (
          <button
            onClick={resetScan}
            className="px-6 py-4 min-h-14 bg-white dark:bg-zinc-800/70 hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] border border-zinc-200 dark:border-zinc-700"
          >
            Cancelar
          </button>
        )}
        {flowState === 'result' && (
          <button
            onClick={resetScan}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 min-h-14 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg shadow-accent-600/20"
          >
            <ScanFace className="w-5 h-5" />
            {isSuccess ? 'Nuevo escaneo' : 'Reintentar'}
          </button>
        )}
      </div>
    </section>
  );
}
