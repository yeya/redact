import { describe, it, expect } from 'vitest';
import { normalizeRect, hitHandle, hitRect, resizeRect } from '../src/lib/geometry';
import type { Region } from '../src/types';

const base = (over: Partial<Region> = {}): Region => ({
  id: 1,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  effect: 'blur',
  strength: 8,
  ...over,
});

describe('normalizeRect', () => {
  it('orders corners into x,y,w,h', () => {
    expect(normalizeRect(10, 20, 5, 15)).toMatchObject({ x: 5, y: 15, w: 5, h: 5 });
    expect(normalizeRect(5, 15, 10, 20)).toMatchObject({ x: 5, y: 15, w: 5, h: 5 });
  });
});

describe('hitHandle', () => {
  // use a 100x100 rect so the 6px handle hit-zones don't overlap each other
  const r = base({ w: 100, h: 100 });
  it('hits each of the 8 handles at scale 1', () => {
    expect(hitHandle(0, 0, r, 1)).toBe('nw');
    expect(hitHandle(50, 0, r, 1)).toBe('n');
    expect(hitHandle(100, 0, r, 1)).toBe('ne');
    expect(hitHandle(100, 50, r, 1)).toBe('e');
    expect(hitHandle(100, 100, r, 1)).toBe('se');
    expect(hitHandle(50, 100, r, 1)).toBe('s');
    expect(hitHandle(0, 100, r, 1)).toBe('sw');
    expect(hitHandle(0, 50, r, 1)).toBe('w');
  });

  it('scales handle positions by zoom', () => {
    expect(hitHandle(0, 0, r, 2)).toBe('nw');
    expect(hitHandle(200, 200, r, 2)).toBe('se'); // 100*2
    expect(hitHandle(100, 0, r, 2)).toBe('n'); // n at 50*2
    expect(hitHandle(200, 100, r, 2)).toBe('e'); // e at 100*2, 50*2
  });

  it('returns null outside any handle', () => {
    expect(hitHandle(50, 50, r, 1)).toBeNull(); // body centre, far from all handles
    expect(hitHandle(150, 150, r, 1)).toBeNull();
  });

  it('respects the halfHandle tolerance', () => {
    // default halfHandle = 8/2+2 = 6; nw handle at (0,0) covers [-6,6]²
    expect(hitHandle(6, 6, r, 1)).toBe('nw');
    expect(hitHandle(7, 7, r, 1)).toBeNull();
    // explicit tolerance of 10: n at (50,0) covers x[40,60], y[-10,10]
    expect(hitHandle(0, 0, r, 1, 10)).toBe('nw');
    expect(hitHandle(41, 0, r, 1, 10)).toBe('n');
    expect(hitHandle(39, 0, r, 1, 10)).toBeNull();
  });
});

describe('hitRect', () => {
  const a = base({ id: 1, x: 0, y: 0, w: 10, h: 10 });
  const b = base({ id: 2, x: 5, y: 5, w: 10, h: 10 });
  const regions = [a, b];

  it('returns the topmost (last-drawn) region on overlap', () => {
    expect(hitRect(8, 8, regions, 1)?.id).toBe(2);
  });
  it('returns the only region containing an exclusive point', () => {
    expect(hitRect(2, 2, regions, 1)?.id).toBe(1);
    expect(hitRect(12, 12, regions, 1)?.id).toBe(2);
  });
  it('returns null outside all regions', () => {
    expect(hitRect(50, 50, regions, 1)).toBeNull();
  });
  it('scales by zoom', () => {
    expect(hitRect(16, 16, regions, 2)?.id).toBe(2); // (8,8) in image space
  });
});

describe('resizeRect', () => {
  const start = base({ x: 10, y: 10, w: 20, h: 20 });

  it('se handle grows right+down', () => {
    expect(resizeRect(start, 'se', 5, 5)).toMatchObject({ x: 10, y: 10, w: 25, h: 25 });
  });
  it('nw handle moves origin and shrinks', () => {
    expect(resizeRect(start, 'nw', 3, 4)).toMatchObject({ x: 13, y: 14, w: 17, h: 16 });
  });
  it('n handle moves top edge only', () => {
    expect(resizeRect(start, 'n', 0, -5)).toMatchObject({ x: 10, y: 5, w: 20, h: 25 });
  });
  it('w handle moves left edge only', () => {
    expect(resizeRect(start, 'w', -5, 0)).toMatchObject({ x: 5, y: 10, w: 25, h: 20 });
  });
  it('clamps width and height to a minimum of 4', () => {
    const out = resizeRect(start, 'se', -18, -18);
    expect(out.w).toBe(4);
    expect(out.h).toBe(4);
  });
  it('clamps even when negative overshoot on the moving edge', () => {
    const out = resizeRect(start, 'nw', 30, 30);
    expect(out.w).toBe(4);
    expect(out.h).toBe(4);
  });
});
