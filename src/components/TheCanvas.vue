<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../stores/editor';
import { useCanvasInteraction } from '../composables/useCanvasInteraction';
import { useImageLoader } from '../composables/useImageLoader';
import { applyEffect } from '../lib/effects';
import { HANDLE_SIZE, handlePoints } from '../lib/geometry';

const store = useEditorStore();
const { requestFile, openFilePicker } = useImageLoader();

const wrapRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const dragOver = ref(false);
let ctx: CanvasRenderingContext2D | null = null;

const { onMousedown, onHover, liveRect, cleanup } = useCanvasInteraction(canvasRef, store);

/** Space around the canvas inside the scroll area, in CSS px. */
const FIT_PADDING = 48;
const IDLE_OUTLINE = 'rgba(255,255,255,0.55)';
let accent = '#5b6af9';

/** Device pixels per CSS pixel the canvas bitmap is currently sized for. */
let dpr = 1;

// ── effect layer cache ─────────────────────────────────────
// The image with every effect baked in, at the canvas's bitmap resolution.
// Rebuilt only when the image, the bitmap size or a region's geometry/effect
// changes — selection, hover and the live draw rect just repaint overlays.
const layer = document.createElement('canvas');
let layerCtx: CanvasRenderingContext2D | null = null;
let layerKey = '';

function effectLayer(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const rs = store.scale * dpr;
  const key = `${w}x${h}@${rs}|${store.regions.map((r) => `${r.x},${r.y},${r.w},${r.h},${r.effect},${r.strength}`).join(';')}`;
  if (key === layerKey && layerCtx) return layer;
  if (layer.width !== w) layer.width = w;
  if (layer.height !== h) layer.height = h;
  layerCtx ??= layer.getContext('2d', { willReadFrequently: true });
  if (!layerCtx) return layer;
  layerCtx.clearRect(0, 0, w, h);
  layerCtx.drawImage(img, 0, 0, w, h);
  for (const r of store.regions) applyEffect(layerCtx, r, rs);
  layerKey = key;
  return layer;
}

// ── render ───────────────────────────────────────────────
function drawHandles(sx: number, sy: number, sw: number, sh: number): void {
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (const { x, y } of Object.values(handlePoints(sx, sy, sw, sh))) {
    ctx.beginPath();
    ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  }
}

function render(): void {
  const c = canvasRef.value;
  if (!c || !ctx || !store.image) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(effectLayer(store.image, c.width, c.height), 0, 0);

  // overlays are drawn in CSS pixels, the same space as mouse coordinates
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = store.scale;
  for (const r of store.regions) {
    const sx = r.x * s;
    const sy = r.y * s;
    const sw = r.w * s;
    const sh = r.h * s;
    const sel = store.isSelected(r.id);
    ctx.save();
    ctx.strokeStyle = sel ? accent : IDLE_OUTLINE;
    ctx.lineWidth = sel ? 2 : 1;
    ctx.setLineDash(sel ? [] : [4, 3]);
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    if (sel) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = accent;
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
  }

  const single = store.singleSelected;
  if (single) drawHandles(single.x * s, single.y * s, single.w * s, single.h * s);

  if (store.mode === 'draw' && liveRect.value) {
    const d = liveRect.value;
    const lx = Math.min(d.x0, d.x1);
    const ly = Math.min(d.y0, d.y1);
    const lw = Math.abs(d.x1 - d.x0);
    const lh = Math.abs(d.y1 - d.y0);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(lx + 0.5, ly + 0.5, lw, lh);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = accent;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.restore();
  }
}

/** Coalesce render requests into at most one paint per animation frame. */
let frame = 0;
function scheduleRender(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    render();
  });
}

// ── canvas sizing ─────────────────────────────────────────
/**
 * Fit the image into the scroll area (never upscaling), size the canvas
 * bitmap for the device pixel ratio, and repaint. The bitmap is only resized
 * when its size actually changes, since resizing a canvas wipes it.
 */
function fitCanvas(): void {
  const c = canvasRef.value;
  const wrap = wrapRef.value;
  const { w: iw, h: ih } = store.imageSize;
  if (!c || !wrap || !store.image || !iw || !ih) return;
  const maxW = Math.max(1, wrap.clientWidth - FIT_PADDING);
  const maxH = Math.max(1, wrap.clientHeight - FIT_PADDING);
  const s = Math.min(1, maxW / iw, maxH / ih);
  store.setScale(s);
  dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(1, Math.round(iw * s));
  const cssH = Math.max(1, Math.round(ih * s));
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (c.width !== bw) c.width = bw;
  if (c.height !== bh) c.height = bh;
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  scheduleRender();
}

function onWindowResize(): void {
  if (store.hasImage) fitCanvas();
}

/** Re-fit when the device pixel ratio changes (browser zoom, moving the
 *  window to another monitor) — not every such change fires `resize`. */
let dprQuery: MediaQueryList | null = null;
function watchDevicePixelRatio(): void {
  dprQuery?.removeEventListener('change', onDprChange);
  if (typeof window.matchMedia !== 'function') return;
  dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  dprQuery.addEventListener('change', onDprChange);
}
function onDprChange(): void {
  watchDevicePixelRatio();
  onWindowResize();
}

// ── drop & paste ───────────────────────────────────────────
function onDragOver(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = true;
}
function onDragLeave(): void {
  dragOver.value = false;
}
function onDrop(e: DragEvent): void {
  e.preventDefault();
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void requestFile(file);
}
function onPaste(e: ClipboardEvent): void {
  if (!e.clipboardData) return;
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (file) void requestFile(file);
}

// ── lifecycle ──────────────────────────────────────────────
onMounted(() => {
  const c = canvasRef.value;
  if (c) ctx = c.getContext('2d');
  accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent;
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('paste', onPaste);
  watchDevicePixelRatio();
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('paste', onPaste);
  dprQuery?.removeEventListener('change', onDprChange);
  if (frame) cancelAnimationFrame(frame);
  cleanup();
});

// Repaint whenever a render input changes (regions, selection, zoom, mode,
// live draw rect).
watch([() => store.regions, () => store.selectedIds, () => store.scale, () => store.mode, liveRect], scheduleRender, {
  deep: true,
});

// A new image needs the canvas re-fitted (which also repaints). `post` so the
// canvas is visible (v-show) and laid out before measuring.
watch(() => store.image, fitCanvas, { flush: 'post' });
</script>

<template>
  <div ref="wrapRef" class="canvas-wrap" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <div v-show="!store.hasImage" class="drop-zone" :class="{ dragover: dragOver }" @click="openFilePicker()">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <h2>{{ $t('dropzone.title') }}</h2>
      <p>{{ $t('dropzone.browse') }}</p>
      <p class="hint">{{ $t('dropzone.hint') }}</p>
    </div>
    <canvas v-show="store.hasImage" ref="canvasRef" class="main-canvas" @mousedown="onMousedown" @mousemove="onHover" />
  </div>
</template>

<style scoped>
.canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  position: relative;
  background: repeating-conic-gradient(#161920 0% 25%, #12151c 0% 50%) 0 0 / 24px 24px;
}
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 420px;
  max-width: 90%;
  padding: 48px 32px;
  border: 2px dashed var(--border);
  border-radius: 16px;
  color: var(--text-dim);
  transition:
    border-color 0.2s,
    background 0.2s;
  text-align: center;
  cursor: pointer;
}
.drop-zone:hover,
.drop-zone.dragover {
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--text);
}
.drop-zone h2 {
  font-size: 16px;
  font-weight: 600;
}
.drop-zone p {
  font-size: 13px;
}
.drop-zone .hint {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.6;
}
.main-canvas {
  cursor: crosshair;
  touch-action: none;
  flex-shrink: 0;
}
</style>
