import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, WarningOctagon, X, CheckCircle, Spinner } from '@phosphor-icons/react';
import { useCameraPermission, CameraPermissionState } from '../hooks/useCameraPermission.ts';

interface CameraPermissionGateProps {
  onProceed: () => void;
  onCancel: () => void;
}

const stateContent: Record<CameraPermissionState, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
}> = {
  checking: {
    title: 'Verificando cámara',
    subtitle: 'Comprobando acceso al dispositivo de captura...',
    icon: <Spinner className="w-8 h-8 animate-spin" weight="regular" />,
    iconBg: 'bg-zinc-100 dark:bg-zinc-800',
  },
  prompt: {
    title: 'Permiso de cámara requerido',
    subtitle: 'FaceAccess Lab necesita acceder a tu cámara para el reconocimiento facial. La imagen se procesa en tiempo real y no se almacena en disco.',
    icon: <Camera className="w-8 h-8" weight="regular" />,
    iconBg: 'bg-accent-100 dark:bg-accent-950/40',
  },
  granted: {
    title: 'Cámara lista',
    subtitle: 'Acceso concedido. Iniciando reconocimiento...',
    icon: <CheckCircle className="w-8 h-8" weight="fill" />,
    iconBg: 'bg-green-100 dark:bg-green-950/40',
  },
  denied: {
    title: 'Cámara no disponible',
    subtitle: 'El acceso a la cámara fue denegado. Para usar el reconocimiento facial, habilita los permisos de cámara en la configuración de tu navegador y vuelve a intentarlo.',
    icon: <WarningOctagon className="w-8 h-8" weight="fill" />,
    iconBg: 'bg-red-100 dark:bg-red-950/40',
  },
  unsupported: {
    title: 'Cámara no soportada',
    subtitle: 'Tu navegador no soporta la API de permisos de cámara. Asegúrate de usar un navegador moderno con HTTPS activo.',
    icon: <WarningOctagon className="w-8 h-8" weight="regular" />,
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
  },
};

export default function CameraPermissionGate({ onProceed, onCancel }: CameraPermissionGateProps) {
  const { permissionState, requestPermission } = useCameraPermission();
  const [isRequesting, setIsRequesting] = React.useState(false);
  const hasAutoRequested = React.useRef(false);

  const handleRequest = React.useCallback(async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        onProceed();
      }
    } catch {
      // Error handled: state stays at permissionState value
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting, requestPermission, onProceed]);

  const handleRequestRef = React.useRef(handleRequest);
  React.useEffect(() => {
    handleRequestRef.current = handleRequest;
  }, [handleRequest]);

  React.useEffect(() => {
    if (hasAutoRequested.current) return;
    hasAutoRequested.current = true;
    const timer = setTimeout(() => {
      handleRequestRef.current();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (permissionState === 'granted') {
      onProceed();
    }
  }, [permissionState, onProceed]);

  const content = stateContent[permissionState];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        >
          <div className="p-8 flex flex-col items-center text-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${content.iconBg} ${permissionState === 'prompt' ? 'text-accent-600 dark:text-accent-400' : permissionState === 'granted' ? 'text-green-600 dark:text-green-400' : permissionState === 'denied' ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
              {content.icon}
            </div>

            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                {content.title}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm">
                {content.subtitle}
              </p>
            </div>

            <div className="flex flex-col w-full gap-2.5 mt-1">
              {permissionState === 'prompt' && (
                <button
                  onClick={handleRequest}
                  disabled={isRequesting}
                  className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isRequesting ? (
                    <>
                      <Spinner className="w-4 h-4 animate-spin" weight="bold" />
                      Solicitando acceso...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" weight="regular" />
                      Activar Cámara
                    </>
                  )}
                </button>
              )}

              {permissionState === 'denied' && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3.5 text-left">
                  <p className="text-caption text-red-700 dark:text-red-400 font-medium leading-relaxed">
                    Para habilitar la cámara: abre la configuración de tu navegador, busca "Cámara" y permite el acceso para este sitio. Luego recarga la página.
                  </p>
                </div>
              )}

              {permissionState === 'checking' && (
                <div className="py-2">
                  <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-accent-500 rounded-full"
                      animate={{ width: ['0%', '70%', '90%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              )}

              {permissionState !== 'granted' && (
                <button
                  onClick={onCancel}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-300 font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" weight="regular" />
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 px-5 py-3 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" aria-hidden="true" />
            <span className="text-label font-mono text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              FaceAccess Lab · Terminal Kiosk
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

