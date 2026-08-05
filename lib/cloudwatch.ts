import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from './observability.ts';

let cwClient: CloudWatchClient | null = null;

function getClient(): CloudWatchClient {
  if (cwClient) return cwClient;

  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  cwClient = new CloudWatchClient({
    region,
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
  });

  return cwClient;
}

export interface MetricDimension {
  Name: string;
  Value: string;
}

/**
 * Publica una métrica en CloudWatch (namespace FaceAccessLab).
 * En entornos sin credenciales AWS (dev/CI) la publicación falla silenciosamente
 * y el error se registra de forma estructurada, sin interrumpir el flujo.
 */
export async function putMetric(
  metricName: string,
  value: number,
  unit: string,
  dimensions: MetricDimension[] = [],
): Promise<boolean> {
  try {
    const cw = getClient();
    await cw.send(
      new PutMetricDataCommand({
        Namespace: 'FaceAccessLab',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit as never,
            Dimensions: dimensions,
          },
        ],
      })
    );
    return true;
  } catch (error: unknown) {
    logger.error('metrics.put.failed', {
      metric: metricName,
      error: error instanceof Error ? error.message : 'desconocido',
    });
    return false;
  }
}

/** Dimensión única kiosco/lab/endpoint para métricas desagregadas. */
const dim = (name: string, value: string): MetricDimension[] => [{ Name: name, Value: value }];

export const Metrics = {
  // ── Acceso ──
  facesIndexed: () => putMetric('faces_indexed', 1, 'Count'),
  facesSearched: () => putMetric('faces_searched', 1, 'Count'),
  accessGranted: () => putMetric('access_granted', 1, 'Count'),
  accessDenied: () => putMetric('access_denied', 1, 'Count'),
  /** Tasa de accesos denegados (0-100) sobre el total del minuto. */
  deniedRate: (percent: number) => putMetric('access_denied_rate', percent, 'Percent'),
  attemptsPerKiosk: (kioskId: string) => putMetric('attempts_per_kiosk', 1, 'Count', dim('KioskId', kioskId)),
  deniedPerKiosk: (kioskId: string) => putMetric('denied_per_kiosk', 1, 'Count', dim('KioskId', kioskId)),

  // ── Latencia ──
  rekognitionLatency: (ms: number) => putMetric('rekognition_latency_ms', ms, 'Milliseconds'),
  livenessLatency: (ms: number) => putMetric('liveness_latency_ms', ms, 'Milliseconds'),
  livenessChecked: () => putMetric('liveness_checked', 1, 'Count'),
  livenessFailed: () => putMetric('liveness_failed', 1, 'Count'),

  // ── Errores ──
  httpError: (endpoint: string, status: number) => putMetric('http_errors', 1, 'Count', dim('Endpoint', endpoint)),
  s3Failure: (operation: string) => putMetric('s3_failures', 1, 'Count', dim('Operation', operation)),
  mongoFailure: (operation: string) => putMetric('mongodb_failures', 1, 'Count', dim('Operation', operation)),
};
