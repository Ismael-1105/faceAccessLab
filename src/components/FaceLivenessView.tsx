'use client';

import { useCallback, useState } from 'react';
import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react-liveness/dist/styles.css';

interface FaceLivenessViewProps {
  attemptId: string;
  sessionId: string;
  onSuccess: () => void;
  onFail: (message: string) => void;
}

export default function FaceLivenessView({ attemptId, sessionId, onSuccess, onFail }: FaceLivenessViewProps) {
  const [error, setError] = useState<string | null>(null);

  const fetchAwsCredentials = useCallback(async () => {
    const headers: Record<string, string> = {};
    headers['x-kiosk-attempt'] = attemptId;
    const res = await fetch('/api/aws/credentials', { headers });
    const data = await res.json();

    if (!data.ok || !data.accessKeyId || !data.secretAccessKey) {
      throw new Error(data.error || 'No se pudieron obtener credenciales');
    }

    return {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
      sessionToken: data.sessionToken,
    };
  }, [attemptId]);

  const handleAnalysisComplete = useCallback(async () => {
    try {
      // El navegador solo informa que el desafío terminó. El backend consultará
      // y decidirá el resultado oficial de Face Liveness al verificar el intento.
      onSuccess();
    } catch (err) {
      console.error('[Liveness] Error obteniendo resultado:', err);
      onFail('Error de conexión durante la verificación.');
    }
  }, [onSuccess, onFail]);

  const handleError = useCallback((livenessError: { state: string; error: Error }) => {
    const message = livenessError?.error?.message || 'Error durante la verificación anti-suplantación';
    console.error('[Liveness] Error:', livenessError.state, message);
    setError(message);
    onFail(message);
  }, [onFail]);

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      {error ? (
        <div className="text-red-500 text-sm text-center p-4">
          {error}
        </div>
      ) : (
        <FaceLivenessDetectorCore
          sessionId={sessionId}
          region="us-east-1"
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
          disableStartScreen
          config={{
            credentialProvider: fetchAwsCredentials,
          }}
        />
      )}
    </div>
  );
}
