'use client';

import { useCallback, useState } from 'react';
import { FaceLivenessDetectorCore } from '@aws-amplify/ui-react-liveness';
import '@aws-amplify/ui-react-liveness/dist/styles.css';
import { LIVENESS_DISPLAY_TEXT_ES } from '../lib/liveness-display-text.ts';

interface FaceLivenessViewProps {
  attemptId: string;
  sessionId: string;
  /**
   * Región donde el servidor creó `sessionId`. ISS-08: estaba escrita a mano
   * como 'us-east-1' mientras el backend usaba `process.env.AWS_REGION`. En
   * cuanto el despliegue definiera otro valor, la sesión se creaba en una región
   * y se consumía en otra: AWS no la encuentra y TODAS las pruebas de vida
   * fallan, sin excepción y sin mensaje claro. Se acepta null solo mientras la
   * respuesta del intento está en vuelo.
   */
  region: string | null;
  onSuccess: () => void;
  onFail: (message: string) => void;
}

export default function FaceLivenessView({ attemptId, sessionId, region, onSuccess, onFail }: FaceLivenessViewProps) {
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
      ) : !region ? (
        // Sin región no se monta el detector: montarlo con un valor supuesto
        // crearía el fallo silencioso que este issue elimina.
        <div className="text-zinc-400 text-sm text-center p-4">
          Preparando la verificación...
        </div>
      ) : (
        <FaceLivenessDetectorCore
          sessionId={sessionId}
          region={region}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
          disableStartScreen
          displayText={LIVENESS_DISPLAY_TEXT_ES}
          config={{
            credentialProvider: fetchAwsCredentials,
          }}
        />
      )}
    </div>
  );
}
