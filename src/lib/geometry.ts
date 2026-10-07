import type { Rect, Region } from '../types';

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

/** Positions of the 8 resize handles of a rect, in the rect's own units. */
export function handlePoints(sx: number, sy: number, sw: number, sh: number): Record<Handle, Point> {
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
}

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
    if (px >= r.x * scale && px <= (r.x + r.w) * scale && py >= r.y * scale && py <= (r.y + r.h) * scale) {
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
export function resizeRect(start: Rect, corner: Handle, dx: number, dy: number): Rect {
  let { x: rx, y: ry, w: rw, h: rh } = start;
  if (corner.includes('n')) {
    ry = start.y + dy;
    rh = start.h - dy;
  }
  if (corner.includes('s')) {
    rh = start.h + dy;
  }
  if (corner.includes('w')) {
    rx = start.x + dx;
    rw = start.w - dx;
  }
  if (corner.includes('e')) {
    rw = start.w + dx;
  }
  return { x: rx, y: ry, w: Math.max(4, rw), h: Math.max(4, rh) };
}

/** Intersect a rect with the `[0,bw]×[0,bh]` image bounds; null if nothing is left. */
export function clipRect(r: Rect, bw: number, bh: number): Rect | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(bw, r.x + r.w);
  const y1 = Math.min(bh, r.y + r.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Clamp a move delta so every rect in the group stays inside the image. The
 * group moves as one, so the rects keep their layout relative to each other.
 */
export function clampGroupDelta(rects: Rect[], dx: number, dy: number, bw: number, bh: number): Point {
  if (rects.length === 0) return { x: dx, y: dy };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return {
    x: Math.min(Math.max(dx, -minX), bw - maxX),
    y: Math.min(Math.max(dy, -minY), bh - maxY),
  };
}
