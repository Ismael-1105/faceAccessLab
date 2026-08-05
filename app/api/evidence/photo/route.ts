import { handleGetEvidencePhoto } from '@/lib/handlers';

export async function GET(req: Request) {
  return handleGetEvidencePhoto(req);
}
