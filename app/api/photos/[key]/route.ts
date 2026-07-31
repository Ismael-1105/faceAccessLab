import { getPresignedUrl } from '@/lib/s3';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const url = await getPresignedUrl(key, 3600);
    return Response.redirect(url);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to generate URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
