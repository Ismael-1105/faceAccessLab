'use client';

import { useCallback, useState } from 'react';
import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react-liveness/dist/styles.css';

interface FaceLivenessViewProps {
  sessionId: string;
  onSuccess: (confidence: number) => void;
  onFail: (message: string) => void;
}

export default function FaceLivenessView({ sessionId, onSuccess, onFail }: FaceLivenessViewProps) {
  const [error, setError] = useState<string | null>(null);

  const fetchAwsCredentials = useCallback(async () => {
    const res = await fetch('/api/aws/credentials');
    const data = await res.json();

    if (!data.ok || !data.accessKeyId || !data.secretAccessKey) {
      throw new Error(data.error || 'No se pudieron obtener credenciales');
    }

    return {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
      sessionToken: data.sessionToken,
    };
  }, []);

  const handleAnalysisComplete = useCallback(async () => {
    try {
      const res = await fetch(`/api/rekognition/liveness?sessionId=${sessionId}`);
      const data = await res.json();

      console.log('[Liveness] Resultado:', data.status, data.confidence);

      if (data.ok && data.passed) {
        onSuccess(data.confidence || 0);
      } else {
        onFail(data.message || 'Verificación anti-suplantación no superada');
      }
    } catch (err) {
      console.error('[Liveness] Error obteniendo resultado:', err);
      onFail('Error de conexión durante la verificación.');
    }
  }, [sessionId, onSuccess, onFail]);

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
