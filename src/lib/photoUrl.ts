// Convierte una referencia de foto en la ruta del proxy presigned.
// Acepta una clave S3 ("students/xxx.jpg"), una URL de S3 legacy o una ruta local.
// Nunca se apunta directamente al bucket: toda foto sensible se sirve vía
// /api/photos (presigned URL de corta duración).
export function getPhotoSrc(photoUrl?: string): string {
  if (!photoUrl) return '/images/camera-feed-bg.jpg';
  if (photoUrl.startsWith('/') || photoUrl.startsWith('blob:') || photoUrl.startsWith('data:')) return photoUrl;

  // amazonaws.com/students/xxx.jpg → /api/photos/students/xxx.jpg
  const awsMatch = photoUrl.match(/amazonaws\.com\/(.+)$/);
  if (awsMatch) {
    return `/api/photos/${encodeURIComponent(awsMatch[1])}`;
  }

  // Clave S3 directa ("students/xxx.jpg") → /api/photos/students/xxx.jpg
  if (!/^https?:\/\//i.test(photoUrl)) {
    return `/api/photos/${encodeURIComponent(photoUrl)}`;
  }

  return photoUrl;
}
