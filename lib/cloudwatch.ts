import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

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

export async function putMetric(
  metricName: string,
  value: number,
  unit: string
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
          },
        ],
      })
    );
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[CloudWatch] Error:', msg);
    return false;
  }
}

export const Metrics = {
  facesIndexed: () => putMetric('faces_indexed', 1, 'Count'),
  facesSearched: () => putMetric('faces_searched', 1, 'Count'),
  accessGranted: () => putMetric('access_granted', 1, 'Count'),
  accessDenied: () => putMetric('access_denied', 1, 'Count'),
  rekognitionLatency: (ms: number) => putMetric('rekognition_latency_ms', ms, 'Milliseconds'),
  livenessChecked: () => putMetric('liveness_checked', 1, 'Count'),
  livenessFailed: () => putMetric('liveness_failed', 1, 'Count'),
};
