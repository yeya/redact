import type { Region } from '../types';

/**
 * Pixelate block size in the *current canvas's* pixel space. Scaled by the
 * display zoom so that the block size in IMAGE pixels is the same on screen
 * (scale s) and at export (scale 1): block_image ≈ strength. The original
 * tool left pixelate unscaled, which made the on-screen preview coarser than
 * the exported file; scaling it matches the blur behaviour and fixes that.
 */
export function pixelateBlock(strength: number, scale: number): number {
  return Math.max(2, Math.round(strength * scale));
}

/** Gaussian-approximation box-blur radius in the current canvas's pixel space. */
export function blurRadius(strength: number, scale: number): number {
  return Math.max(1, Math.round(strength * scale));
}

/**
 * Sample the top-left pixel of each `block`×`block` cell and flood-fill the
 * cell with it. Edges (partial cells) are handled by the `x+dx<w` / `y+dy<h`
 * guards. Operates in place on an RGBA buffer.
 */
export function pixelate(data: Uint8ClampedArray, w: number, h: number, block: number): void {
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      const i = (y * w + x) * 4;
      const rv = data[i];
      const gv = data[i + 1];
      const bv = data[i + 2];
      const av = data[i + 3];
      for (let dy = 0; dy < block && y + dy < h; dy++) {
        for (let dx = 0; dx < block && x + dx < w; dx++) {
          const j = ((y + dy) * w + (x + dx)) * 4;
          data[j] = rv;
          data[j + 1] = gv;
          data[j + 2] = bv;
          data[j + 3] = av;
        }
      }
    }
  }
}

/**
 * Blur one line of pixels (a row or a column) with a running-sum box filter,
 * so the cost per pixel is constant regardless of radius. `start` is the index
 * of the line's first pixel and `step` the distance between its pixels, both
 * in pixels. Sampling indices clamp to the line's ends; alpha is copied.
 */
function blurLine(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  start: number,
  step: number,
  len: number,
  r: number,
): void {
  const div = 2 * r + 1;
  const at = (k: number) => (start + Math.min(len - 1, Math.max(0, k)) * step) * 4;
  let rs = 0,
    gs = 0,
    bs = 0;
  for (let k = -r; k <= r; k++) {
    const i = at(k);
    rs += src[i];
    gs += src[i + 1];
    bs += src[i + 2];
  }
  for (let n = 0; n < len; n++) {
    const j = (start + n * step) * 4;
    dst[j] = rs / div;
    dst[j + 1] = gs / div;
    dst[j + 2] = bs / div;
    dst[j + 3] = src[j + 3];
    const add = at(n + r + 1);
    const sub = at(n - r);
    rs += src[add] - src[sub];
    gs += src[add + 1] - src[sub + 1];
    bs += src[add + 2] - src[sub + 2];
  }
}

/**
 * Separable box blur: a horizontal pass into a scratch buffer, then a vertical
 * pass back into `data`. Alpha is preserved (copied, not averaged) to match
 * the original. Edges clamp the sampling index to [0, w-1] / [0, h-1]. Runs
 * in O(w·h) independent of the radius.
 */
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number): void {
  if (r <= 0 || w === 0 || h === 0) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) blurLine(data, tmp, y * w, 1, w, r);
  for (let x = 0; x < w; x++) blurLine(tmp, data, x, w, h, r);
}

/**
 * Render one region's effect onto a 2D context. `sc` is the scale from image
 * pixels to this canvas's pixels (the display zoom for the on-screen canvas,
 * 1 for the full-resolution export canvas). The display and export canvases
 * share this code path so the result stays consistent across zoom levels.
 *
 * The covered pixel rect is the region expanded outwards to whole pixels
 * (floor the start, ceil the end), so a fractional edge never leaves a
 * partially-covered pixel unredacted, then clamped to the canvas so an
 * out-of-bounds region can't crash `getImageData`.
 */
export function applyEffect(ctx: CanvasRenderingContext2D, r: Region, sc: number): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  const sx = Math.max(0, Math.floor(r.x * sc));
  const sy = Math.max(0, Math.floor(r.y * sc));
  const sw = Math.min(cw, Math.ceil((r.x + r.w) * sc)) - sx;
  const sh = Math.min(ch, Math.ceil((r.y + r.h) * sc)) - sy;
  if (sw < 1 || sh < 1) return;

  if (r.effect === 'black') {
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, sy, sw, sh);
    return;
  }
  if (r.effect === 'white') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx, sy, sw, sh);
    return;
  }

  if (r.effect === 'pixelate') {
    const block = pixelateBlock(r.strength, sc);
    const d = ctx.getImageData(sx, sy, sw, sh);
    pixelate(d.data, sw, sh, block);
    ctx.putImageData(d, sx, sy);
    return;
  }

  // blur + frosted. Sample a padded area so pixels near the region's edge
  // blur against their real neighbours (two passes reach 2×radius), but write
  // back only the region itself — nothing outside it may change.
  const radius = blurRadius(r.strength, sc);
  const pad = radius * 2;
  const gx = Math.max(0, sx - pad);
  const gy = Math.max(0, sy - pad);
  const gw = Math.min(cw, sx + sw + pad) - gx;
  const gh = Math.min(ch, sy + sh + pad) - gy;
  const d = ctx.getImageData(gx, gy, gw, gh);
  boxBlur(d.data, gw, gh, radius);
  boxBlur(d.data, gw, gh, radius);
  ctx.putImageData(d, gx, gy, sx - gx, sy - gy, sw, sh);
  if (r.effect === 'frosted') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(sx, sy, sw, sh);
  }
}
