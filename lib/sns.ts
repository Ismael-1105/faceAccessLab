import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

let snsClient: SNSClient | null = null;

function getClient(): SNSClient {
  if (snsClient) return snsClient;

  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  snsClient = new SNSClient({
    region,
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
  });

  return snsClient;
}

export async function publishAlert(
  subject: string,
  message: string
): Promise<boolean> {
  const topicArn = process.env.AWS_SNS_TOPIC_ARN;
  if (!topicArn) {
    console.warn('[SNS] AWS_SNS_TOPIC_ARN no configurado');
    return false;
  }

  try {
    const sns = getClient();
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: subject,
        Message: message,
      })
    );
    console.log(`[SNS] Alerta publicada: ${subject}`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[SNS] Error publicando alerta:', msg);
    return false;
  }
}
