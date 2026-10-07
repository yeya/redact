import { describe, it, expect } from 'vitest';
import { hitHandle, hitRect, resizeRect, clipRect, clampGroupDelta, handlePoints } from '../src/lib/geometry';
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

describe('handlePoints', () => {
  it('places corners and edge midpoints', () => {
    expect(handlePoints(10, 20, 100, 50)).toEqual({
      nw: { x: 10, y: 20 },
      n: { x: 60, y: 20 },
      ne: { x: 110, y: 20 },
      e: { x: 110, y: 45 },
      se: { x: 110, y: 70 },
      s: { x: 60, y: 70 },
      sw: { x: 10, y: 70 },
      w: { x: 10, y: 45 },
    });
  });
});

describe('clipRect', () => {
  it('returns the part inside the bounds', () => {
    expect(clipRect({ x: -5, y: 10, w: 20, h: 100 }, 50, 40)).toEqual({ x: 0, y: 10, w: 15, h: 30 });
  });
  it('is the identity for a rect already inside', () => {
    expect(clipRect({ x: 1, y: 2, w: 3, h: 4 }, 50, 40)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
  it('returns null when nothing overlaps', () => {
    expect(clipRect({ x: 60, y: 0, w: 10, h: 10 }, 50, 40)).toBeNull();
    expect(clipRect({ x: 0, y: -20, w: 10, h: 20 }, 50, 40)).toBeNull();
  });
});

describe('clampGroupDelta', () => {
  const group = [
    { x: 10, y: 10, w: 10, h: 10 },
    { x: 30, y: 5, w: 5, h: 5 },
  ];
  it('passes small deltas through', () => {
    expect(clampGroupDelta(group, 3, -2, 100, 100)).toEqual({ x: 3, y: -2 });
  });
  it('stops the group at each edge', () => {
    expect(clampGroupDelta(group, 500, 500, 100, 100)).toEqual({ x: 65, y: 80 });
    expect(clampGroupDelta(group, -500, -500, 100, 100)).toEqual({ x: -10, y: -5 });
  });
  it('passes the delta through for an empty group', () => {
    expect(clampGroupDelta([], 7, 8, 10, 10)).toEqual({ x: 7, y: 8 });
  });
});
