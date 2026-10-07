import { vi } from 'vitest';

/**
 * Minimal in-memory stand-in for CanvasRenderingContext2D. jsdom has no canvas
 * implementation, so this keeps a real RGBA buffer for the pixel operations the
 * app uses (getImageData / putImageData / solid fillRect) and logs everything
 * else so tests can assert on call order.
 */
export class FakeContext2D {
  data: Uint8ClampedArray;
  ops: string[] = [];
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  globalAlpha = 1;

  constructor(public canvas: HTMLCanvasElement) {
    this.data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }

  /** Called when the canvas is resized: like a real canvas, the bitmap resets. */
  reset(): void {
    this.data = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4);
    this.ops.push('reset');
  }

  get width(): number {
    return this.canvas.width;
  }

  pixel(x: number, y: number): [number, number, number, number] {
    const i = (y * this.canvas.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  setPixel(x: number, y: number, rgba: [number, number, number, number]): void {
    const i = (y * this.canvas.width + x) * 4;
    this.data.set(rgba, i);
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
      const src = ((y + row) * this.canvas.width + x) * 4;
      out.set(this.data.subarray(src, src + w * 4), row * w * 4);
    }
    this.ops.push(`getImageData(${x},${y},${w},${h})`);
    return { data: out, width: w, height: h };
  }

  putImageData(
    img: { data: Uint8ClampedArray; width: number; height: number },
    dx: number,
    dy: number,
    dirtyX = 0,
    dirtyY = 0,
    dirtyW = img.width,
    dirtyH = img.height,
  ): void {
    for (let row = dirtyY; row < dirtyY + dirtyH; row++) {
      for (let col = dirtyX; col < dirtyX + dirtyW; col++) {
        const s = (row * img.width + col) * 4;
        const d = ((dy + row) * this.canvas.width + (dx + col)) * 4;
        this.data.set(img.data.subarray(s, s + 4), d);
      }
    }
    this.ops.push(`putImageData(${dx},${dy})`);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ops.push(`fillRect(${this.fillStyle})`);
    const [r, g, b, a] = parseColor(this.fillStyle);
    const alpha = a * this.globalAlpha;
    for (let py = Math.max(0, y); py < Math.min(this.canvas.height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(this.canvas.width, x + w); px++) {
        const i = (py * this.canvas.width + px) * 4;
        this.data[i] = this.data[i] * (1 - alpha) + r * alpha;
        this.data[i + 1] = this.data[i + 1] * (1 - alpha) + g * alpha;
        this.data[i + 2] = this.data[i + 2] * (1 - alpha) + b * alpha;
        this.data[i + 3] = Math.max(this.data[i + 3], alpha * 255);
      }
    }
  }

  drawImage(): void {
    this.ops.push('drawImage');
  }
  clearRect(): void {
    this.ops.push('clearRect');
  }
  strokeRect(): void {}
  rect(): void {}
  beginPath(): void {}
  fill(): void {}
  stroke(): void {}
  save(): void {}
  restore(): void {}
  setLineDash(): void {}
  setTransform(): void {}
}

function parseColor(c: string): [number, number, number, number] {
  if (c === '#000' || c === '#000000') return [0, 0, 0, 1];
  if (c === '#fff' || c === '#ffffff') return [255, 255, 255, 1];
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  return [0, 0, 0, 1];
}

/** Build a canvas of the given size backed by a FakeContext2D. */
export function fakeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: FakeContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = contextFor(canvas);
  return { canvas, ctx };
}

const contexts = new WeakMap<HTMLCanvasElement, FakeContext2D>();

export function contextFor(canvas: HTMLCanvasElement): FakeContext2D {
  let ctx = contexts.get(canvas);
  if (!ctx) {
    ctx = new FakeContext2D(canvas);
    contexts.set(canvas, ctx);
  }
  return ctx;
}

export const blobControl: { next: Blob | null | undefined; calls: { type?: string; quality?: number }[] } = {
  next: undefined,
  calls: [],
};

/**
 * Patch HTMLCanvasElement so getContext returns a FakeContext2D, resizing
 * resets the bitmap (as a real canvas does), and toBlob resolves
 * asynchronously with `blobControl.next` (default: a small Blob).
 */
export function installCanvasMock(): void {
  blobControl.next = undefined;
  blobControl.calls = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return contextFor(this) as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    blobControl.calls.push({ type, quality });
    const blob = blobControl.next === undefined ? new Blob(['x'], { type: type ?? 'image/png' }) : blobControl.next;
    setTimeout(() => cb(blob), 0);
  });
  for (const dim of ['width', 'height'] as const) {
    const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dim)!;
    vi.spyOn(HTMLCanvasElement.prototype, dim, 'set').mockImplementation(function (this: HTMLCanvasElement, v: number) {
      desc.set!.call(this, v);
      contexts.get(this)?.reset();
    });
  }
}

/**
 * Replace requestAnimationFrame with a manual queue so tests decide when a
 * frame runs. `flushFrames()` runs everything queued so far.
 */
export function installRafMock(): { flushFrames: () => void } {
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return {
    flushFrames() {
      const q = queue;
      queue = [];
      for (const cb of q) cb(performance.now());
    },
  };
}

/** A stand-in image: drawImage is faked, so only the dimensions matter. */
export function fakeImage(w: number, h: number): HTMLImageElement {
  return { naturalWidth: w, naturalHeight: h, width: w, height: h } as unknown as HTMLImageElement;
}
