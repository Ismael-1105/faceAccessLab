'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Fingerprint, Camera as CameraIcon } from 'lucide-react';
import { useKioskFlow } from '@/src/hooks/useKioskFlow';
import KioskCameraView from '@/src/components/kiosk/KioskCameraView';
import KioskStepper from '@/src/components/kiosk/KioskStepper';

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
          FaceAccess Lab necesita acceso a la cámara. Habilita los permisos en tu navegador.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-2 px-8 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

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
        <div className="w-20 hidden sm:block" />
      </header>

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
