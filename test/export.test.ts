import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildOutputCanvas, copyImg, exportImg } from '../src/lib/export';
import { blobControl, contextFor, fakeImage, installCanvasMock } from './helpers/canvas';

describe('export', () => {
  const img = fakeImage(40, 30);
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    installCanvasMock();
    createObjectURL = vi.fn(() => 'blob:fake');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('buildOutputCanvas', () => {
    it('renders at the full image resolution', () => {
      const c = buildOutputCanvas(img, [], 'png');
      expect([c.width, c.height]).toEqual([40, 30]);
    });

    it('JPEG paints a white background before the image (no black transparency)', () => {
      const ops = contextFor(buildOutputCanvas(img, [], 'jpg')).ops;
      expect(ops.indexOf('fillRect(#fff)')).toBeGreaterThan(-1);
      expect(ops.indexOf('fillRect(#fff)')).toBeLessThan(ops.indexOf('drawImage'));
    });

    it('PNG and WebP keep transparency', () => {
      for (const fmt of ['png', 'webp'] as const) {
        const ops = contextFor(buildOutputCanvas(img, [], fmt)).ops;
        expect(ops.slice(0, ops.indexOf('drawImage')).some((o) => o.startsWith('fillRect'))).toBe(false);
      }
    });
  });

  describe('exportImg', () => {
    it('resolves true, downloads with the right type, and revokes the URL later', async () => {
      const p = exportImg(img, [], 'jpg');
      await vi.advanceTimersByTimeAsync(0);
      expect(await p).toBe(true);
      expect(blobControl.calls[0]).toEqual({ type: 'image/jpeg', quality: 0.93 });
      expect(anchorClick).toHaveBeenCalledTimes(1);
      // revoking synchronously after click() can cancel the download in some browsers
      expect(revokeObjectURL).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    });

    it('resolves false and downloads nothing when encoding fails', async () => {
      blobControl.next = null;
      const p = exportImg(img, [], 'png');
      await vi.advanceTimersByTimeAsync(0);
      expect(await p).toBe(false);
      expect(anchorClick).not.toHaveBeenCalled();
    });
  });

  describe('copyImg', () => {
    let items: Record<string, unknown>[];
    let write: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      items = [];
      vi.stubGlobal(
        'ClipboardItem',
        class {
          constructor(data: Record<string, unknown>) {
            items.push(data);
          }
        },
      );
      write = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    });

    it('creates the ClipboardItem synchronously with a Promise<Blob> (Safari needs this)', async () => {
      const p = copyImg(img, []);
      // still inside the click handler's task: the item must already exist
      expect(items).toHaveLength(1);
      expect(items[0]['image/png']).toBeInstanceOf(Promise);
      await vi.advanceTimersByTimeAsync(0);
      expect(await p).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('resolves false when the clipboard rejects', async () => {
      write.mockRejectedValueOnce(new Error('denied'));
      const p = copyImg(img, []);
      await vi.advanceTimersByTimeAsync(0);
      expect(await p).toBe(false);
    });
  });
});
