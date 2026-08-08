import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

// Doble del SDK: el cliente devuelve lo que le pongamos en `send`.
vi.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: class {
    send = mocks.send;
  },
  CreateCollectionCommand: class {},
  IndexFacesCommand: class {},
  SearchFacesByImageCommand: class { constructor(public input: unknown) {} },
  DeleteFacesCommand: class {},
  ListCollectionsCommand: class {},
  ListFacesCommand: class {},
  DetectFacesCommand: class {},
}));
vi.mock('../../lib/cloudwatch.ts', () => ({
  Metrics: {
    facesSearched: vi.fn(),
    rekognitionLatency: vi.fn(),
    facesIndexed: vi.fn(),
    rekognitionFailure: vi.fn(),
  },
}));

import { searchFace } from '../../lib/rekognition.ts';

const IMG = new Uint8Array([1, 2, 3]);

/**
 * Respuesta con los dos campos deliberadamente distintos.
 *
 * Face.Confidence es la confianza de que la región indexada contiene un rostro,
 * y en la práctica siempre ronda 99.9. Similarity es la semejanza real entre el
 * rostro capturado y el almacenado, que es lo que el kiosco debe reportar.
 */
function searchResponse(similarity: number, faceConfidence: number) {
  return {
    FaceMatches: [{
      Similarity: similarity,
      Face: {
        FaceId: 'f1',
        ExternalImageId: 'student-1',
        Confidence: faceConfidence,
      },
    }],
  };
}

describe('rekognition: searchFace reporta la similitud real (ISS-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    // ensureCollection() se ejecuta antes de buscar: ListCollections primero.
    mocks.send.mockResolvedValueOnce({ CollectionIds: ['faceaccess-lab-students'] });
  });

  it('propaga Similarity y no Face.Confidence', async () => {
    mocks.send.mockResolvedValueOnce(searchResponse(91.2, 99.9));

    const result = await searchFace(IMG);

    expect(result.confidence).toBe(91.2);
    expect(result.confidence).not.toBe(99.9);
    expect(result.studentId).toBe('student-1');
    expect(result.faceId).toBe('f1');
  });

  it('distingue dos coincidencias de calidad distinta', async () => {
    // Con el campo equivocado ambas darían 99.9 y serían indistinguibles.
    mocks.send.mockResolvedValueOnce(searchResponse(88.4, 99.9));
    const flojo = await searchFace(IMG);

    mocks.send.mockResolvedValueOnce({ CollectionIds: ['faceaccess-lab-students'] });
    mocks.send.mockResolvedValueOnce(searchResponse(97.6, 99.9));
    const bueno = await searchFace(IMG);

    expect(flojo.confidence).toBe(88.4);
    expect(bueno.confidence).toBe(97.6);
    expect(flojo.confidence).not.toBe(bueno.confidence);
  });

  it('una coincidencia marginal queda por debajo del umbral por alumno', async () => {
    // Es el efecto que ISS-09 desbloquea: el umbral individual de Calibración
    // deja de compararse contra un valor casi constante y empieza a filtrar.
    mocks.send.mockResolvedValueOnce(searchResponse(70.0, 99.9));

    const result = await searchFace(IMG);

    expect(result.confidence).toBeLessThan(85);
  });

  it('devuelve 0 y sin estudiante cuando no hay coincidencias', async () => {
    mocks.send.mockResolvedValueOnce({ FaceMatches: [] });

    const result = await searchFace(IMG);

    expect(result.studentId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
