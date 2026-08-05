import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Metrics } from './cloudwatch.ts';
import { logger } from './observability.ts';

const BUCKET = process.env.AWS_S3_BUCKET || 'faceaccess-lab-uploads';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (s3Client) return s3Client;

  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  s3Client = new S3Client({
    region,
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
  });

  return s3Client;
}

/**
 * Sube una imagen al bucket PRIVADO con cifrado KMS (aws:kms). Devuelve la
 * CLAVE del objeto, nunca una URL pública: el acceso se sirve únicamente a
 * través de presigned URLs de corta duración generadas por el backend.
 */
export async function uploadImage(
  key: string,
  imageBase64: string,
  contentType = 'image/jpeg'
): Promise<string> {
  const s3 = getClient();

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: 'aws:kms',
    ...(process.env.AWS_KMS_KEY_ID ? { SSEKMSKeyId: process.env.AWS_KMS_KEY_ID } : {}),
  });

  try {
    await s3.send(command);
  } catch (error: unknown) {
    void Metrics.s3Failure('putObject');
    logger.error('s3.upload.failed', { error: error instanceof Error ? error.message : 'desconocido' });
    throw error;
  }

  return key;
}

/**
 * URL firmada de corta duración (5 min por defecto). El bucket debe estar
 * bloqueado para acceso público: toda lectura pasa por aquí.
 */
export async function getPresignedUrl(key: string, expiresIn = 300): Promise<string> {
  const s3 = getClient();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  try {
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error: unknown) {
    void Metrics.s3Failure('getSignedUrl');
    logger.error('s3.presign.failed', { error: error instanceof Error ? error.message : 'desconocido' });
    throw error;
  }
}

export async function deleteImage(key: string): Promise<void> {
  const s3 = getClient();
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch (error: unknown) {
    void Metrics.s3Failure('deleteObject');
    logger.error('s3.delete.failed', { error: error instanceof Error ? error.message : 'desconocido' });
    throw error;
  }
}

export function extractS3Key(url: string): string | null {
  const match = url.match(/amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

export function getS3Bucket(): string {
  return BUCKET;
}
