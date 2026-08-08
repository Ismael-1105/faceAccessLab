'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Fingerprint, Camera as CameraIcon, Maximize2, Minimize2, Volume2, VolumeX,
  Wifi, WifiOff, Sun, SunDim,
} from 'lucide-react';
import { useKioskFlow } from '@/src/hooks/useKioskFlow';
import KioskCameraView from '@/src/components/kiosk/KioskCameraView';
import KioskStepper from '@/src/components/kiosk/KioskStepper';

function StatusPill({ ok, label, Icon, aria }: { ok: boolean; label: string; Icon: typeof Wifi; aria: string }) {
  return (
    <span
      role="status"
      aria-label={aria}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
        ok
          ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/40'
          : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function KioscoPage() {
  const router = useRouter();
  const kiosk = useKioskFlow();

  if (kiosk.cameraDenied) {
    return (
      <div className="min-h-screen bg-surface dark:bg-zinc-950 flex flex-col items-center justify-center p-8 gap-5">
        <div className="w-20 h-20 rounded-[20px] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <CameraIcon className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Cámara requerida</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
          La cámara está ocupada por otra aplicación o pestaña (por ejemplo, otra pestaña del kiosco
          abierta). Ciérrala, vuelve a esta pestaña e intenta nuevamente.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => kiosk.retryWebcam()}
            className="px-8 py-4 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer"
          >
            Reintentar cámara
          </button>
          <button
            onClick={() => router.back()}
            className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const lightingOk = kiosk.framing.feedback.issue !== 'low-light';
  const connected = kiosk.isOnline && kiosk.serverReachable;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Barra superior */}
      <header className="flex items-center justify-between px-5 md:px-8 py-3 border-b border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Salir
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center">
            <Fingerprint className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">FaceAccess Lab</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-mono">Acceso Biométrico</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={kiosk.toggleSound}
            className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
            aria-label={kiosk.soundEnabled ? 'Silenciar señales sonoras' : 'Activar señales sonoras'}
            title="Sonido"
          >
            {kiosk.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={kiosk.toggleFullscreen}
            className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
            aria-label={kiosk.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title="Pantalla completa"
          >
            {kiosk.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Estado del terminal: cámara, conectividad e iluminación */}
      <div className="px-5 md:px-8 pt-3 flex flex-wrap items-center gap-2" aria-live="polite">
        <StatusPill ok={kiosk.cameraReady} label="Cámara" Icon={CameraIcon} aria="Estado de la cámara" />
        <StatusPill ok={connected} label={connected ? 'En línea' : 'Sin conexión'} Icon={connected ? Wifi : WifiOff} aria="Conectividad" />
        <StatusPill ok={lightingOk} label="Iluminación" Icon={lightingOk ? Sun : SunDim} aria="Comprobación de iluminación" />
        {kiosk.attemptCountdown > 0 && (
          <span
            role="timer"
            aria-label={`Tiempo restante del intento: ${kiosk.attemptCountdown} segundos`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40"
          >
            <CameraIcon className="w-3 h-3" /> {kiosk.attemptCountdown}s
          </span>
        )}
      </div>

      {/* Banner offline */}
      {!connected && (
        <div role="alert" className="mx-5 md:mx-8 mt-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300 font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          Sin conexión con el servidor: el kiosco reintentará automáticamente. Los eventos de diagnóstico
          se guardan localmente y se enviarán al recuperar la conexión.
        </div>
      )}

      <main className="flex-grow p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          <KioskCameraView
            videoRef={kiosk.videoRef}
            flowState={kiosk.flowState}
            statusMessage={kiosk.statusMessage}
            statusHint={kiosk.statusHint}
            scanBlocked={kiosk.scanBlocked}
            livenessSessionId={kiosk.livenessSessionId}
            kioskAttemptId={kiosk.kioskAttemptId}
            cameras={kiosk.cameras}
            selectedCamera={kiosk.selectedCamera}
            showSettings={kiosk.showSettings}
            isScanning={kiosk.isScanning}
            isSuccess={kiosk.isSuccess}
            isError={kiosk.isError}
            showFaceGuide={kiosk.showFaceGuide}
            framingIssue={kiosk.framing.feedback.issue}
            framingQuality={kiosk.framing.feedback.quality}
            framingBox={kiosk.framing.box}
            holdProgress={kiosk.holdProgress}
            scanProgress={kiosk.scanProgress}
            denialReason={kiosk.denialReason}
            resetCountdown={kiosk.resetCountdown}
            startLiveness={kiosk.startLiveness}
            toggleSettings={kiosk.toggleSettings}
            switchCamera={kiosk.switchCamera}
            toggleScanBlocked={kiosk.toggleScanBlocked}
            resetScan={kiosk.resetScan}
            onLivenessSuccess={kiosk.handleLivenessSuccess}
            onLivenessFail={kiosk.handleLivenessFail}
          />

          <KioskStepper
            flowState={kiosk.flowState}
            activeStage={kiosk.activeStage}
            statusMessage={kiosk.statusMessage}
            statusHint={kiosk.statusHint}
            isSuccess={kiosk.isSuccess}
            denialReason={kiosk.denialReason}
            scannedStudent={kiosk.scannedStudent}
            scannedPhotoUrl={kiosk.scannedPhotoUrl}
            confidence={kiosk.confidence}
            resetCountdown={kiosk.resetCountdown}
            consecutiveDenials={kiosk.consecutiveDenials}
            sessionInfo={kiosk.sessionInfo}
            onPrintReceipt={kiosk.handlePrintReceipt}
          />
        </div>
      </main>
    </div>
  );
}
