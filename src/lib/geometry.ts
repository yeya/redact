import type { Region } from '../types';

export const HANDLE_SIZE = 8;
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type Handle = (typeof HANDLES)[number];

export interface Point {
  x: number;
  y: number;
}

/** Screen (canvas) pixels → image pixels. */
export function screenToImage(px: number, py: number, scale: number): Point {
  return { x: px / scale, y: py / scale };
}

/** Image pixels → screen (canvas) pixels. */
export function imageToScreen(x: number, y: number, scale: number): Point {
  return { x: x * scale, y: y * scale };
}

/** Normalise a drag rectangle (any two opposite corners) to {x,y,w,h}. */
export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Region {
  return {
    id: 0,
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
    effect: 'blur',
    strength: 8,
  };
}

const handlePoints = (sx: number, sy: number, sw: number, sh: number): Record<Handle, Point> => {
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  return {
    nw: { x: sx, y: sy },
    n: { x: cx, y: sy },
    ne: { x: sx + sw, y: sy },
    e: { x: sx + sw, y: cy },
    se: { x: sx + sw, y: sy + sh },
    s: { x: cx, y: sy + sh },
    sw: { x: sx, y: sy + sh },
    w: { x: sx, y: cy },
  };
};

/**
 * Hit-test the 8 resize handles of a single selected region. `px,py` are in
 * screen (canvas) pixels; the region is in image pixels and scaled internally.
 * Returns the matched handle or null. `halfHandle` is the hit tolerance
 * (HANDLE_SIZE/2 + 2 by default).
 */
export function hitHandle(
  px: number,
  py: number,
  region: Region,
  scale: number,
  halfHandle: number = HANDLE_SIZE / 2 + 2,
): Handle | null {
  const sx = region.x * scale;
  const sy = region.y * scale;
  const sw = region.w * scale;
  const sh = region.h * scale;
  const pts = handlePoints(sx, sy, sw, sh);
  for (const corner of HANDLES) {
    const p = pts[corner];
    if (px >= p.x - halfHandle && px <= p.x + halfHandle && py >= p.y - halfHandle && py <= p.y + halfHandle) {
      return corner;
    }
  }
  return null;
}

/**
 * Hit-test region bodies (topmost wins — last-drawn is on top). `px,py` are
 * screen pixels; regions are scaled internally. Returns the matched region
 * or null.
 */
export function hitRect(px: number, py: number, regions: Region[], scale: number): Region | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (
      px >= r.x * scale &&
      px <= (r.x + r.w) * scale &&
      py >= r.y * scale &&
      py <= (r.y + r.h) * scale
    ) {
      return r;
    }
  }
  return null;
}

/**
 * Compute a resized rectangle from a pre-drag snapshot, a corner, and image-
 * space deltas. `n`/`s` adjust the top edge + height; `w`/`e` adjust the left
 * edge + width. Width/height clamp at 4 image px (matches the original).
 */
export function resizeRect(
  start: Region,
  corner: Handle,
  dx: number,
  dy: number,
): Pick<Region, 'x' | 'y' | 'w' | 'h'> {
  let { x: rx, y: ry, w: rw, h: rh } = start;
  if (corner.includes('n')) { ry = start.y + dy; rh = start.h - dy; }
  if (corner.includes('s')) { rh = start.h + dy; }
  if (corner.includes('w')) { rx = start.x + dx; rw = start.w - dx; }
  if (corner.includes('e')) { rw = start.w + dx; }
  return { x: rx, y: ry, w: Math.max(4, rw), h: Math.max(4, rh) };
}
