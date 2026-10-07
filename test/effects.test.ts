import { describe, it, expect } from 'vitest';
import { pixelate, boxBlur, pixelateBlock, blurRadius } from '../src/lib/effects';

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
    const w = 4, h = 4;
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
    const w = 3, h = 1;
    const d = rgba([[10, 0, 0, 255], [200, 0, 0, 255], [20, 0, 0, 255]], w, h);
    pixelate(d, w, h, 2);
    expect(redAt(d, w, 0, 0)).toBe(10);
    expect(redAt(d, w, 1, 0)).toBe(10);
    expect(redAt(d, w, 2, 0)).toBe(20); // partial block uses its own top-left
    expect(d.length).toBe(w * h * 4); // no overflow
  });
});

describe('boxBlur', () => {
  it('horizontal pass averages with edge clamp (single row → vertical identity)', () => {
    const w = 3, h = 1;
    const d = rgba([[0, 0, 0, 255], [90, 0, 0, 255], [180, 0, 0, 255]], w, h);
    boxBlur(d, w, h, 1);
    // tmp[0]=(0+0+90)/3=30 ; tmp[1]=(0+90+180)/3=90 ; tmp[2]=(90+180+180)/3=150
    expect(redAt(d, w, 0, 0)).toBe(30);
    expect(redAt(d, w, 1, 0)).toBe(90);
    expect(redAt(d, w, 2, 0)).toBe(150);
  });

  it('vertical pass averages with edge clamp (single column → horizontal identity)', () => {
    const w = 1, h = 3;
    const d = rgba([[0, 0, 0, 255], [90, 0, 0, 255], [180, 0, 0, 255]], w, h);
    boxBlur(d, w, h, 1);
    expect(redAt(d, w, 0, 0)).toBe(30);
    expect(redAt(d, w, 0, 1)).toBe(90);
    expect(redAt(d, w, 0, 2)).toBe(150);
  });

  it('preserves alpha (alpha is copied, not averaged)', () => {
    const w = 3, h = 1;
    const d = rgba([[0, 0, 0, 100], [90, 0, 0, 200], [180, 0, 0, 50]], w, h);
    boxBlur(d, w, h, 1);
    expect(d[3]).toBe(100);
    expect(d[7]).toBe(200);
    expect(d[11]).toBe(50);
  });

  it('radius 0 is a no-op (every pixel averages only itself)', () => {
    const w = 3, h = 1;
    const d = rgba([[10, 0, 0, 255], [20, 0, 0, 255], [30, 0, 0, 255]], w, h);
    boxBlur(d, w, h, 0);
    expect(redAt(d, w, 0, 0)).toBe(10);
    expect(redAt(d, w, 1, 0)).toBe(20);
    expect(redAt(d, w, 2, 0)).toBe(30);
  });
});
