import { connectDB } from '@/lib/db';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { getAuthPayload } from '@/lib/auth';
import { User, Student, AccessLog, Alert, Lab } from '@/lib/models';

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

function getCwClient(): CloudWatchClient {
  if (cwClient) return cwClient;
  const region = process.env.AWS_REGION || 'us-east-1';
  cwClient = new CloudWatchClient({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
      : undefined,
  });
  return cwClient;
}

/**
 * GET /api/health
 *
 * - Sin sesión (público, usado como ping de conectividad del kiosco):
 *   responde 200 inmediatamente con estado ligero, sin tocar MongoDB ni AWS.
 * - Con sesión admin/docente: devuelve el diagnóstico completo (conteos,
 *   CloudWatch y configuración) para HealthCard y la página de diagnóstico.
 */
export async function GET(req: Request) {
  const auth = getAuthPayload(req);
  const isStaff = auth && (auth.role === 'admin' || auth.role === 'docente');

  if (!isStaff) {
    return new Response(JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'api',
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // MongoDB
  let db: { connected: boolean; counts?: Record<string, number>; error?: string } = { connected: false };
  try {
    await connectDB();
    const [users, students, logs, alerts, labs] = await Promise.all([
      User.countDocuments(),
      Student.countDocuments(),
      AccessLog.countDocuments(),
      Alert.countDocuments(),
      Lab.countDocuments(),
    ]);
    db = { connected: true, counts: { users, students, logs, alerts, labs } };
  } catch (e) {
    db = { connected: false, error: e instanceof Error ? e.message : 'Error de conexión' };
  }

  // CloudWatch (24h)
  let cloudwatch: { ok: boolean; metrics?: Record<string, number>; error?: string } = { ok: false };
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const result = await getCwClient().send(new GetMetricDataCommand({
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
    }));
    const totals: Record<string, number> = {};
    METRICS.forEach((name, i) => {
      const ts = result.MetricDataResults?.[i];
      totals[name] = ts?.Values?.reduce((a, b) => a + b, 0) ?? 0;
    });
    cloudwatch = { ok: true, metrics: totals };
  } catch (e) {
    cloudwatch = { ok: false, error: e instanceof Error ? e.message : 'CloudWatch no disponible' };
  }

  const awsConfigured = Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );

  return new Response(JSON.stringify({
    ok: db.connected && cloudwatch.ok,
    timestamp: new Date().toISOString(),
    mongo: db,
    cloudwatch,
    aws: {
      configured: awsConfigured,
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET || null,
      snsTopic: Boolean(process.env.AWS_SNS_TOPIC_ARN),
    },
  }), { headers: { 'Content-Type': 'application/json' } });
}
