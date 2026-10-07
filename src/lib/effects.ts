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
 * Separable box blur: a horizontal pass into `tmp`, then a vertical pass into
 * `tmp2`, then written back. Alpha is preserved (copied, not averaged) to match
 * the original. Edges clamp the sampling index to [0, w-1] / [0, h-1].
 */
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number): void {
  const tmp = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0, c = 0;
      for (let kx = -r; kx <= r; kx++) {
        const nx = Math.max(0, Math.min(w - 1, x + kx));
        const i = (y * w + nx) * 4;
        rr += data[i];
        gg += data[i + 1];
        bb += data[i + 2];
        c++;
      }
      const j = (y * w + x) * 4;
      tmp[j] = rr / c;
      tmp[j + 1] = gg / c;
      tmp[j + 2] = bb / c;
      tmp[j + 3] = data[j + 3];
    }
  }
  const tmp2 = new Uint8ClampedArray(tmp);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0, c = 0;
      for (let ky = -r; ky <= r; ky++) {
        const ny = Math.max(0, Math.min(h - 1, y + ky));
        const i = (ny * w + x) * 4;
        rr += tmp[i];
        gg += tmp[i + 1];
        bb += tmp[i + 2];
        c++;
      }
      const j = (y * w + x) * 4;
      tmp2[j] = rr / c;
      tmp2[j + 1] = gg / c;
      tmp2[j + 2] = bb / c;
      tmp2[j + 3] = tmp[j + 3];
    }
  }
  data.set(tmp2);
}

/**
 * Render one region's effect onto a 2D context. `sc` is the scale from image
 * pixels to this canvas's pixels (the display zoom for the on-screen canvas,
 * 1 for the full-resolution export canvas). The display and export canvases
 * share this code path so the result stays consistent across zoom levels.
 *
 * The region is clamped to the canvas bounds before sampling so an
 * out-of-bounds region (e.g. dragged partly off-canvas) doesn't crash
 * `getImageData` — a latent crash in the original that only affected
 * off-canvas regions, never in-bounds ones.
 */
export function applyEffect(ctx: CanvasRenderingContext2D, r: Region, sc: number): void {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  let sx = Math.round(r.x * sc);
  let sy = Math.round(r.y * sc);
  let sw = Math.round(r.w * sc);
  let sh = Math.round(r.h * sc);

  if (sx < 0) { sw += sx; sx = 0; }
  if (sy < 0) { sh += sy; sy = 0; }
  if (sx + sw > cw) sw = cw - sx;
  if (sy + sh > ch) sh = ch - sy;
  if (sw < 2 || sh < 2) return;

  if (r.effect === 'black') { ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, sw, sh); return; }
  if (r.effect === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, sw, sh); return; }

  if (r.effect === 'pixelate') {
    const block = pixelateBlock(r.strength, sc);
    const d = ctx.getImageData(sx, sy, sw, sh);
    pixelate(d.data, sw, sh, block);
    ctx.putImageData(d, sx, sy);
    return;
  }

  // blur + frosted
  const radius = blurRadius(r.strength, sc);
  const pad = radius;
  const gx = Math.max(0, sx - pad);
  const gy = Math.max(0, sy - pad);
  const gw = Math.min(cw - gx, sw + pad * 2);
  const gh = Math.min(ch - gy, sh + pad * 2);
  const d = ctx.getImageData(gx, gy, gw, gh);
  boxBlur(d.data, gw, gh, radius);
  boxBlur(d.data, gw, gh, radius);
  ctx.putImageData(d, gx, gy);
  if (r.effect === 'frosted') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(sx, sy, sw, sh);
  }
}
