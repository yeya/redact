import type { Region } from '../types';
import { applyEffect } from './effects';

export type ExportFormat = 'png' | 'jpg' | 'webp';

/** Render the image at full original resolution with all effects baked in. */
export function buildOutputCanvas(img: HTMLImageElement, regions: Region[]): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = img.naturalWidth || img.width;
  oc.height = img.naturalHeight || img.height;
  const octx = oc.getContext('2d', { willReadFrequently: true })!;
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

/** Export and trigger a download. */
export function exportImg(img: HTMLImageElement, regions: Region[], fmt: ExportFormat): void {
  const oc = buildOutputCanvas(img, regions);
  oc.toBlob(
    (blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fmt === 'jpg' ? 'redacted.jpg' : `redacted.${fmt}`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    mimeFor(fmt),
    qualityFor(fmt),
  );
}

/** Copy the full-resolution PNG to the clipboard. Resolves to true on success. */
export function copyImg(img: HTMLImageElement, regions: Region[]): Promise<boolean> {
  const oc = buildOutputCanvas(img, regions);
  return new Promise((resolve) => {
    oc.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        resolve(true);
      } catch {
        resolve(false);
      }
    }, 'image/png');
  });
}
