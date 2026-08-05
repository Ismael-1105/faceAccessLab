import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
} from '@aws-sdk/client-rekognition';

let client: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  if (client) return client;

  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
  }

  client = new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export interface LivenessSession {
  sessionId: string;
  expiry: number;
}

export async function createLivenessSession(): Promise<LivenessSession> {
  const rekognition = getClient();

  const result = await rekognition.send(
    new CreateFaceLivenessSessionCommand({})
  );

  if (!result.SessionId) {
    throw new Error('No se pudo crear la sesión de liveness');
  }

  return {
    sessionId: result.SessionId,
    expiry: Date.now() + 120_000,
  };
}

export interface LivenessResult {
  status: string;
  confidence: number;
  /** Imagen de referencia elegida por AWS dentro de la sesión verificada. */
  referenceImageBytes: Uint8Array | null;
}

export async function getLivenessResult(sessionId: string): Promise<LivenessResult> {
  const rekognition = getClient();

  const result = await rekognition.send(
    new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId })
  );

  return {
    status: result.Status || 'FAILED',
    confidence: result.Confidence ?? 0,
    referenceImageBytes: result.ReferenceImage?.Bytes || null,
  };
}
