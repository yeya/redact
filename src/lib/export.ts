import type { Region } from '../types';
import { applyEffect } from './effects';

export type ExportFormat = 'png' | 'jpg' | 'webp';

/** How long a download's object URL stays alive. Revoking right after
 *  `click()` can cancel the download in some browsers. */
const REVOKE_DELAY_MS = 40_000;

/**
 * Render the image at full original resolution with all effects baked in.
 * JPEG has no alpha channel, so it gets a white background — otherwise
 * transparent pixels would encode as black.
 */
export function buildOutputCanvas(img: HTMLImageElement, regions: Region[], fmt: ExportFormat): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = img.naturalWidth || img.width;
  oc.height = img.naturalHeight || img.height;
  const octx = oc.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('Canvas 2D context unavailable (image may exceed the browser canvas size limit)');
  if (fmt === 'jpg') {
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, oc.width, oc.height);
  }
  octx.drawImage(img, 0, 0);
  for (const r of regions) applyEffect(octx, r, 1);
  return oc;
}

function mimeFor(fmt: ExportFormat): string {
  if (fmt === 'jpg') return 'image/jpeg';
  if (fmt === 'webp') return 'image/webp';
  return 'image/png';
}

function qualityFor(fmt: ExportFormat): number {
  return fmt === 'png' ? 1 : 0.93;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), type, quality);
  });
}

/** Export and trigger a download. Resolves to true once the download starts. */
export async function exportImg(img: HTMLImageElement, regions: Region[], fmt: ExportFormat): Promise<boolean> {
  try {
    const blob = await toBlob(buildOutputCanvas(img, regions, fmt), mimeFor(fmt), qualityFor(fmt));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redacted.${fmt}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy the full-resolution PNG to the clipboard. Resolves to true on success.
 * The ClipboardItem is created synchronously with a Promise<Blob> — Safari
 * rejects clipboard writes that start after an await, because the user
 * gesture has expired by then.
 */
export async function copyImg(img: HTMLImageElement, regions: Region[]): Promise<boolean> {
  try {
    const blob = toBlob(buildOutputCanvas(img, regions, 'png'), 'image/png');
    blob.catch(() => {}); // a failed encode surfaces through write(); don't also report it as unhandled
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
