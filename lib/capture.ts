export interface CaptureOptions {
  format?: string;
  quality?: number;
}

export function captureFrame(
  videoEl: HTMLVideoElement,
  options: CaptureOptions = {}
): string | null {
  const format = options.format || 'image/jpeg';
  const quality = options.quality ?? 0.9;

  if (!videoEl) {
    console.warn('[Capture] No video element');
    return null;
  }

  if (videoEl.readyState < 2) {
    console.warn('[Capture] Video not ready. readyState:', videoEl.readyState);
    return null;
  }

  if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    console.warn('[Capture] Video dimensions are 0x0');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('[Capture] No 2D context');
    return null;
  }

  ctx.drawImage(videoEl, 0, 0);
  const dataUrl = canvas.toDataURL(format, quality);

  console.log(`[Capture] Frame captured: ${canvas.width}x${canvas.height}, quality=${quality}, ${(dataUrl.length / 1024).toFixed(0)}KB`);
  return dataUrl;
}

export async function captureBurst(
  videoEl: HTMLVideoElement,
  count = 3,
  intervalMs = 300,
  format = 'image/jpeg',
  quality = 0.85
): Promise<string[]> {
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const frame = captureFrame(videoEl, { format, quality });
    if (frame) frames.push(frame);
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  console.log(`[Capture] Burst captured: ${frames.length}/${count} frames`);
  return frames;
}
