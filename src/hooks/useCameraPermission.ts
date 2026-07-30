import { useState, useCallback, useRef, useEffect } from 'react';

export type CameraPermissionState = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: 640,
  height: 480,
  facingMode: 'user',
};

export function useCameraPermission() {
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('checking');
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const checkPermission = useCallback(async (): Promise<CameraPermissionState> => {
    try {
      console.log('[useCameraPermission] checkPermission: consultando permisos...');
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const state = result.state as CameraPermissionState;
      console.log('[useCameraPermission] checkPermission: estado obtenido:', state);
      setPermissionState(state);
      return state;
    } catch (err) {
      console.log('[useCameraPermission] checkPermission: error/API no soportada:', err);
      const state: CameraPermissionState = 'unsupported';
      setPermissionState(state);
      return state;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[useCameraPermission] requestPermission: solicitando getUserMedia...');
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      console.log('[useCameraPermission] requestPermission: stream obtenido, deteniendo...');
      streamRef.current = stream;
      stopStream();
      setPermissionState('granted');
      console.log('[useCameraPermission] requestPermission: PERMISO CONCEDIDO');
      return true;
    } catch (err) {
      const error = err as DOMException;
      console.log('[useCameraPermission] requestPermission: ERROR:', error.name, error.message);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        setPermissionState('unsupported');
      }
      return false;
    }
  }, [stopStream]);

  const getStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      streamRef.current = stream;
      return stream;
    } catch {
      return null;
    }
  }, [stopStream]);

  useEffect(() => {
    checkPermission().then(state => {
      const handleChange = () => {
        checkPermission();
      };
      try {
        navigator.permissions.query({ name: 'camera' as PermissionName }).then(permissionStatus => {
          permissionStatus.onchange = handleChange;
        });
      } catch {
        /* permissions API not supported */
      }
      return () => {
        stopStream();
      };
    });
    return () => {
      stopStream();
    };
  }, [checkPermission, stopStream]);

  return { permissionState, requestPermission, getStream, stopStream, checkPermission };
}
