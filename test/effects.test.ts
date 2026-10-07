import { describe, it, expect } from 'vitest';
import { pixelate, boxBlur, pixelateBlock, blurRadius, applyEffect } from '../src/lib/effects';
import type { Region } from '../src/types';
import { fakeCanvas } from './helpers/canvas';

/** Build an RGBA buffer from per-pixel [r,g,b,a] tuples. */
function rgba(pixels: number[][], w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  pixels.forEach((p, i) => {
    d[i * 4] = p[0];
    d[i * 4 + 1] = p[1];
    d[i * 4 + 2] = p[2];
    d[i * 4 + 3] = p[3];
  });
  return d;
}

function redAt(d: Uint8ClampedArray, w: number, x: number, y: number): number {
  return d[(y * w + x) * 4];
}

describe('pixelateBlock / blurRadius', () => {
  it('pixelate block scales by zoom with a floor of 2', () => {
    expect(pixelateBlock(8, 1)).toBe(8);
    expect(pixelateBlock(8, 0.5)).toBe(4);
    expect(pixelateBlock(8, 2)).toBe(16);
    expect(pixelateBlock(1, 1)).toBe(2); // floor
    expect(pixelateBlock(3, 0.4)).toBe(2); // round(1.2)=1 floored to 2
  });

  it('blur radius scales by zoom with a floor of 1', () => {
    expect(blurRadius(8, 1)).toBe(8);
    expect(blurRadius(8, 0.5)).toBe(4);
    expect(blurRadius(8, 2)).toBe(16);
    expect(blurRadius(0, 1)).toBe(1); // floor
  });

  it('keeps block size in IMAGE pixels constant across zoom (screen vs export)', () => {
    // on screen at scale s, block in screen-px = pixelateBlock(str,s); divide by s
    // to express in image-px; should equal the export block (scale 1).
    for (const s of [0.25, 0.5, 0.75, 1, 1.5, 2]) {
      const imagePx = pixelateBlock(8, s) / s;
      expect(Math.round(imagePx)).toBe(8);
    }
  });
});

describe('pixelate', () => {
  it('flood-fills each block with its top-left pixel', () => {
    // 4x4, block 2. Top-left of each 2x2 block is distinct; the rest are 200.
    const w = 4,
      h = 4;
    const px: number[][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.push([200, 0, 0, 255]);
    // set top-left of each block
    px[0] = [10, 0, 0, 255]; // (0,0)
    px[2] = [20, 0, 0, 255]; // (2,0)
    px[8] = [30, 0, 0, 255]; // (0,2)
    px[10] = [40, 0, 0, 255]; // (2,2)
    const d = rgba(px, w, h);
    pixelate(d, w, h, 2);
    expect(redAt(d, w, 0, 0)).toBe(10);
    expect(redAt(d, w, 1, 0)).toBe(10);
    expect(redAt(d, w, 0, 1)).toBe(10);
    expect(redAt(d, w, 1, 1)).toBe(10);
    expect(redAt(d, w, 2, 0)).toBe(20);
    expect(redAt(d, w, 3, 1)).toBe(20);
    expect(redAt(d, w, 0, 2)).toBe(30);
    expect(redAt(d, w, 1, 3)).toBe(30);
    expect(redAt(d, w, 2, 2)).toBe(40);
    expect(redAt(d, w, 3, 3)).toBe(40);
  });

  it('handles partial edge blocks without overflowing the buffer', () => {
    // w=3, block=2: blocks at x=0 (full) and x=2 (partial, 1px wide).
    const w = 3,
      h = 1;
    const d = rgba(
      [
        [10, 0, 0, 255],
        [200, 0, 0, 255],
        [20, 0, 0, 255],
      ],
      w,
      h,
    );
    pixelate(d, w, h, 2);
    expect(redAt(d, w, 0, 0)).toBe(10);
    expect(redAt(d, w, 1, 0)).toBe(10);
    expect(redAt(d, w, 2, 0)).toBe(20); // partial block uses its own top-left
    expect(d.length).toBe(w * h * 4); // no overflow
  });
});

describe('boxBlur', () => {
  it('horizontal pass averages with edge clamp (single row → vertical identity)', () => {
    const w = 3,
      h = 1;
    const d = rgba(
      [
        [0, 0, 0, 255],
        [90, 0, 0, 255],
        [180, 0, 0, 255],
      ],
      w,
      h,
    );
    boxBlur(d, w, h, 1);
    // tmp[0]=(0+0+90)/3=30 ; tmp[1]=(0+90+180)/3=90 ; tmp[2]=(90+180+180)/3=150
    expect(redAt(d, w, 0, 0)).toBe(30);
    expect(redAt(d, w, 1, 0)).toBe(90);
    expect(redAt(d, w, 2, 0)).toBe(150);
  });

  it('vertical pass averages with edge clamp (single column → horizontal identity)', () => {
    const w = 1,
      h = 3;
    const d = rgba(
      [
        [0, 0, 0, 255],
        [90, 0, 0, 255],
        [180, 0, 0, 255],
      ],
      w,
      h,
    );
    boxBlur(d, w, h, 1);
    expect(redAt(d, w, 0, 0)).toBe(30);
    expect(redAt(d, w, 0, 1)).toBe(90);
    expect(redAt(d, w, 0, 2)).toBe(150);
  });

  it('preserves alpha (alpha is copied, not averaged)', () => {
    const w = 3,
      h = 1;
    const d = rgba(
      [
        [0, 0, 0, 100],
        [90, 0, 0, 200],
        [180, 0, 0, 50],
      ],
      w,
      h,
    );
    boxBlur(d, w, h, 1);
    expect(d[3]).toBe(100);
    expect(d[7]).toBe(200);
    expect(d[11]).toBe(50);
  });

  it('matches the straightforward O(w·h·r) reference exactly', () => {
    /** The original per-pixel kernel implementation. */
    function reference(data: Uint8ClampedArray, w: number, h: number, r: number) {
      const tmp = new Uint8ClampedArray(data);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let rr = 0,
            gg = 0,
            bb = 0;
          for (let k = -r; k <= r; k++) {
            const i = (y * w + Math.max(0, Math.min(w - 1, x + k))) * 4;
            rr += data[i];
            gg += data[i + 1];
            bb += data[i + 2];
          }
          const j = (y * w + x) * 4;
          tmp[j] = rr / (2 * r + 1);
          tmp[j + 1] = gg / (2 * r + 1);
          tmp[j + 2] = bb / (2 * r + 1);
        }
      const out = new Uint8ClampedArray(tmp);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let rr = 0,
            gg = 0,
            bb = 0;
          for (let k = -r; k <= r; k++) {
            const i = (Math.max(0, Math.min(h - 1, y + k)) * w + x) * 4;
            rr += tmp[i];
            gg += tmp[i + 1];
            bb += tmp[i + 2];
          }
          const j = (y * w + x) * 4;
          out[j] = rr / (2 * r + 1);
          out[j + 1] = gg / (2 * r + 1);
          out[j + 2] = bb / (2 * r + 1);
        }
      data.set(out);
    }

    const w = 37,
      h = 23;
    let seed = 42;
    const src = new Uint8ClampedArray(w * h * 4).map(() => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed & 255;
    });
    for (const r of [1, 2, 5, 18, 50]) {
      const fast = src.slice();
      const slow = src.slice();
      boxBlur(fast, w, h, r);
      reference(slow, w, h, r);
      expect(Array.from(fast), `radius ${r}`).toEqual(Array.from(slow));
    }
  });

  it('radius 0 is a no-op (every pixel averages only itself)', () => {
    const w = 3,
      h = 1;
    const d = rgba(
      [
        [10, 0, 0, 255],
        [20, 0, 0, 255],
        [30, 0, 0, 255],
      ],
      w,
      h,
    );
    boxBlur(d, w, h, 0);
    expect(redAt(d, w, 0, 0)).toBe(10);
    expect(redAt(d, w, 1, 0)).toBe(20);
    expect(redAt(d, w, 2, 0)).toBe(30);
  });
});

describe('applyEffect', () => {
  /** 40×30 canvas filled with a deterministic pseudo-random pattern. */
  function noisyCanvas() {
    const { ctx } = fakeCanvas(40, 30);
    let seed = 7;
    for (let i = 0; i < ctx.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      ctx.data[i] = seed & 255;
      ctx.data[i + 1] = (seed >> 8) & 255;
      ctx.data[i + 2] = (seed >> 16) & 255;
      ctx.data[i + 3] = 255;
    }
    return ctx;
  }

  const region = (over: Partial<Region>): Region => ({
    id: 1,
    x: 10,
    y: 10,
    w: 10,
    h: 10,
    effect: 'blur',
    strength: 3,
    ...over,
  });

  for (const effect of ['blur', 'frosted', 'pixelate'] as const) {
    it(`${effect} leaves every pixel outside the region untouched`, () => {
      const ctx = noisyCanvas();
      const before = ctx.data.slice();
      applyEffect(ctx as unknown as CanvasRenderingContext2D, region({ effect }), 1);
      let changedInside = 0;
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          const i = (y * 40 + x) * 4;
          const same =
            ctx.data[i] === before[i] && ctx.data[i + 1] === before[i + 1] && ctx.data[i + 2] === before[i + 2];
          const inside = x >= 10 && x < 20 && y >= 10 && y < 20;
          if (!inside) expect(same, `pixel (${x},${y}) outside the region changed`).toBe(true);
          else if (!same) changedInside++;
        }
      }
      expect(changedInside).toBeGreaterThan(50);
    });
  }

  it('solid fill covers every pixel a fractional region touches', () => {
    const { ctx } = fakeCanvas(40, 10);
    // x spans 10.6 → 31.2, y spans 2.5 → 5.5: columns 10..31 and rows 2..5 are (partly) inside
    applyEffect(
      ctx as unknown as CanvasRenderingContext2D,
      region({ x: 10.6, y: 2.5, w: 20.6, h: 3, effect: 'white' }),
      1,
    );
    for (const x of [10, 31]) for (const y of [2, 5]) expect(ctx.pixel(x, y)[0], `(${x},${y})`).toBe(255);
    expect(ctx.pixel(9, 3)[0]).toBe(0);
    expect(ctx.pixel(32, 3)[0]).toBe(0);
    expect(ctx.pixel(15, 1)[0]).toBe(0);
    expect(ctx.pixel(15, 6)[0]).toBe(0);
  });

  it('pixelate covers fractional edges too', () => {
    const ctx = noisyCanvas();
    const before = ctx.data.slice();
    applyEffect(
      ctx as unknown as CanvasRenderingContext2D,
      region({ x: 10.6, y: 10, w: 9.8, h: 10, effect: 'pixelate', strength: 10 }),
      1,
    );
    // column 10 is 40% inside the region (10.6 → 20.4) and must be redacted
    // into the same block as column 11
    expect(ctx.pixel(10, 15)).toEqual(ctx.pixel(11, 15));
    const i = (15 * 40 + 10) * 4;
    expect(ctx.pixel(10, 15).slice(0, 3)).not.toEqual([before[i], before[i + 1], before[i + 2]]);
  });
});
