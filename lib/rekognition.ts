import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  ListCollectionsCommand,
  ListFacesCommand,
} from '@aws-sdk/client-rekognition';
import { connectDB } from './db.ts';
import { Student } from './models.ts';

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

  await connectDB();
  await Student.findOneAndUpdate(
    { id: studentId },
    { $set: { faceEmbeddingId: faceId } }
  );

  console.log(`[Rekognition] Face indexed for student ${studentId} → faceId ${faceId}`);
  return faceId;
}

export async function searchFace(imageBytes: Uint8Array): Promise<FaceMatchResult> {
  await ensureCollection();
  const rekognition = getClient();

  try {
    const result = await rekognition.send(
      new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: imageBytes },
        MaxFaces: 5,
        FaceMatchThreshold: 85,
      })
    );

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

    const externalImageId = bestMatch.Face.ExternalImageId || null;
    const confidence = bestMatch.Face.Confidence ?? 0;
    const faceId = bestMatch.Face.FaceId || null;

    let studentName: string | null = null;
    if (externalImageId) {
      await connectDB();
      const student = await Student.findOne({ id: externalImageId });
      studentName = student?.name || null;
    }

    return {
      studentId: externalImageId,
      studentName,
      confidence: parseFloat(confidence.toFixed(1)),
      faceId,
      externalImageId,
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
