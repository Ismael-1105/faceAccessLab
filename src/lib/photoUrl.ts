// Convierte una URL de S3 (pública o guardada) en la ruta del proxy presigned.
// Si la URL ya es local (/images, /api/photos), la devuelve tal cual.
export function getPhotoSrc(photoUrl?: string): string {
  if (!photoUrl) return '/images/camera-feed-bg.jpg';
  if (photoUrl.startsWith('/') || photoUrl.startsWith('blob:')) return photoUrl;

  // amazonaws.com/students/xxx.jpg → /api/photos/students/xxx.jpg
  const match = photoUrl.match(/amazonaws\.com\/(.+)$/);
  if (match) {
    const key = match[1];
    return `/api/photos/${encodeURIComponent(key)}`;
  }

  return photoUrl;
}
