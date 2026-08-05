import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { requireTeacher } from '@/lib/rbac';

const NAMESPACE = 'FaceAccessLab';
const METRICS = [
  'faces_indexed',
  'faces_searched',
  'access_granted',
  'access_denied',
  'rekognition_latency_ms',
  'liveness_checked',
  'liveness_failed',
];

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

export async function GET(req: Request) {
  try {
    requireTeacher(req);
    const cw = getClient();
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const result = await cw.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: METRICS.map((name, i) => ({
          Id: `m${i}`,
          MetricStat: {
            Metric: { Namespace: NAMESPACE, MetricName: name },
            Period: 3600,
            Stat: 'Sum',
          },
        })),
      })
    );

    const totals: Record<string, number> = {};
    METRICS.forEach((name, i) => {
      const timestamps = result.MetricDataResults?.[i];
      totals[name] = timestamps?.Values?.reduce((a, b) => a + b, 0) ?? 0;
    });

    return new Response(JSON.stringify({
      ok: true,
      namespace: NAMESPACE,
      window: '24h',
      metrics: totals,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500;
    if (status === 401 || status === 403) {
      return new Response(JSON.stringify({ ok: false, error: status === 401 ? 'No autorizado' : 'Acceso restringido', metrics: {} }), {
        status, headers: { 'Content-Type': 'application/json' },
      });
    }
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({
      ok: false,
      error: msg,
      metrics: {},
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
