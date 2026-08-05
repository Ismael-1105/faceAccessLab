import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  ListCollectionsCommand,
  ListFacesCommand,
  DetectFacesCommand,
} from '@aws-sdk/client-rekognition';
import { Metrics } from './cloudwatch.ts';
import { REKOGNITION_MATCH_THRESHOLD } from './biometrics.ts';

const COLLECTION_ID = 'faceaccess-lab-students';

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

export interface FaceMatchResult {
  studentId: string | null;
  studentName: string | null;
  confidence: number;
  faceId: string | null;
  externalImageId: string | null;
}

export async function ensureCollection(): Promise<void> {
  const rekognition = getClient();

  try {
    const { CollectionIds } = await rekognition.send(new ListCollectionsCommand({}));
    if (CollectionIds?.includes(COLLECTION_ID)) return;

    await rekognition.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
    console.log(`[Rekognition] Collection "${COLLECTION_ID}" created`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ResourceAlreadyExistsException')) return;
    throw error;
  }
}

export async function indexFace(imageBytes: Uint8Array, studentId: string): Promise<string | null> {
  await ensureCollection();
  const rekognition = getClient();

  const result = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBytes },
      ExternalImageId: studentId,
      DetectionAttributes: ['DEFAULT'],
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    })
  );

  const faceRecord = result.FaceRecords?.[0];
  if (!faceRecord?.Face?.FaceId) {
    console.warn(`[Rekognition] No face detected for student ${studentId}`);
    return null;
  }

  const faceId = faceRecord.Face.FaceId;
  const quality = faceRecord.FaceDetail?.Quality?.Sharpness ?? 0;

  console.log(`[Rekognition] Face indexed: student=${studentId} faceId=${faceId} confidence=${faceRecord.Face.Confidence ?? 0} sharpness=${quality}`);
  Metrics.facesIndexed();
  return faceId;
}

export async function searchFace(imageBytes: Uint8Array): Promise<FaceMatchResult> {
  await ensureCollection();
  const rekognition = getClient();

  const start = Date.now();

  try {
    const result = await rekognition.send(
      new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: imageBytes },
        MaxFaces: 5,
        FaceMatchThreshold: REKOGNITION_MATCH_THRESHOLD,
      })
    );

    Metrics.facesSearched();
    Metrics.rekognitionLatency(Date.now() - start);

    const bestMatch = result.FaceMatches?.[0];
    if (!bestMatch?.Face) {
      return {
        studentId: null,
        studentName: null,
        confidence: 0,
        faceId: null,
        externalImageId: null,
      };
    }

    return {
      studentId: bestMatch.Face.ExternalImageId || null,
      studentName: null,
      confidence: parseFloat((bestMatch.Face.Confidence ?? 0).toFixed(1)),
      faceId: bestMatch.Face.FaceId || null,
      externalImageId: bestMatch.Face.ExternalImageId || null,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('InvalidParameterException') && msg.includes('no faces')) {
      return {
        studentId: null,
        studentName: null,
        confidence: 0,
        faceId: null,
        externalImageId: null,
      };
    }
    throw error;
  }
}

export async function deleteFace(faceId: string): Promise<void> {
  const rekognition = getClient();
  await rekognition.send(
    new DeleteFacesCommand({ CollectionId: COLLECTION_ID, FaceIds: [faceId] })
  );
}

export async function listFaces(): Promise<{ faceId: string; studentId: string }[]> {
  await ensureCollection();
  const rekognition = getClient();

  const faces: { faceId: string; studentId: string }[] = [];
  let token: string | undefined;

  do {
    const result = await rekognition.send(
      new ListFacesCommand({
        CollectionId: COLLECTION_ID,
        MaxResults: 1000,
        NextToken: token,
      })
    );
    for (const face of result.Faces || []) {
      if (face.FaceId && face.ExternalImageId) {
        faces.push({ faceId: face.FaceId, studentId: face.ExternalImageId });
      }
    }
    token = result.NextToken;
  } while (token);

  return faces;
}

export interface FaceAttributes {
  faceDetected: boolean;
  eyesOpen: boolean | null;
  smiling: boolean | null;
  mouthOpen: boolean | null;
  yaw: number | null;
  sharpness: number;
  brightness: number;
}

export async function detectFaceAttributes(imageBytes: Uint8Array): Promise<FaceAttributes> {
  const rekognition = getClient();

  const result = await rekognition.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ['DEFAULT'],
    })
  );

  const detail = result.FaceDetails?.[0];

  if (!detail) {
    return {
      faceDetected: false,
      eyesOpen: null,
      smiling: null,
      mouthOpen: null,
      yaw: null,
      sharpness: 0,
      brightness: 0,
    };
  }

  return {
    faceDetected: true,
    eyesOpen: detail.EyesOpen?.Value ?? null,
    smiling: detail.Smile?.Value ?? null,
    mouthOpen: detail.MouthOpen?.Value ?? null,
    yaw: detail.Pose?.Yaw ?? null,
    sharpness: detail.Quality?.Sharpness ?? 0,
    brightness: detail.Quality?.Brightness ?? 0,
  };
}
