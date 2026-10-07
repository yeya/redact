<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect } from 'vue';
import { useEditorStore } from '../stores/editor';
import { useCanvasInteraction } from '../composables/useCanvasInteraction';
import { useImageLoader } from '../composables/useImageLoader';
import { applyEffect } from '../lib/effects';
import { HANDLE_SIZE } from '../lib/geometry';

const store = useEditorStore();
const { loadFile, confirmLoad } = useImageLoader();

const wrapRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const dropZoneRef = ref<HTMLDivElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;

const { onMousedown, onHover, liveRect, cleanup } = useCanvasInteraction(canvasRef, store);

// ── render ───────────────────────────────────────────────
function drawHandles(sx: number, sy: number, sw: number, sh: number): void {
  if (!ctx) return;
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const pts: Record<string, [number, number]> = {
    nw: [sx, sy], n: [cx, sy], ne: [sx + sw, sy], e: [sx + sw, cy],
    se: [sx + sw, sy + sh], s: [cx, sy + sh], sw: [sx, sy + sh], w: [sx, cy],
  };
  for (const [hx, hy] of Object.values(pts)) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#5b6af9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  }
}

function render(): void {
  const c = canvasRef.value;
  if (!c || !ctx || !store.image) return;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(store.image, 0, 0, c.width, c.height);

  for (const r of store.regions) applyEffect(ctx, r, store.scale);

  for (const r of store.regions) {
    const sx = r.x * store.scale;
    const sy = r.y * store.scale;
    const sw = r.w * store.scale;
    const sh = r.h * store.scale;
    const sel = store.isSelected(r.id);
    ctx.save();
    ctx.strokeStyle = sel ? '#5b6af9' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.setLineDash(sel ? [] : [4, 3]);
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    ctx.setLineDash([]);
    if (sel) {
      ctx.fillStyle = 'rgba(91,106,249,0.07)';
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
  }

  if (store.selectedIds.length === 1) {
    const r = store.singleSelected;
    if (r) drawHandles(r.x * store.scale, r.y * store.scale, r.w * store.scale, r.h * store.scale);
  }

  if (store.mode === 'draw' && liveRect.value) {
    const d = liveRect.value;
    const lx = Math.min(d.x0, d.x1);
    const ly = Math.min(d.y0, d.y1);
    const lw = Math.abs(d.x1 - d.x0);
    const lh = Math.abs(d.y1 - d.y0);
    ctx.save();
    ctx.strokeStyle = '#5b6af9';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(lx + 0.5, ly + 0.5, lw, lh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(91,106,249,0.08)';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.restore();
  }
}

// ── canvas sizing ─────────────────────────────────────────
function fitCanvas(): void {
  const c = canvasRef.value;
  const wrap = wrapRef.value;
  const img = store.image;
  if (!c || !wrap || !img) return;
  const pad = 48;
  const maxW = wrap.clientWidth - pad;
  const maxH = wrap.clientHeight - pad;
  const s = Math.min(1, maxW / img.width, maxH / img.height);
  store.setScale(s);
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
}

function onWindowResize(): void {
  if (store.hasImage) fitCanvas();
}

// ── drop & paste ───────────────────────────────────────────
function onDragOver(e: DragEvent): void {
  e.preventDefault();
  dropZoneRef.value?.classList.add('dragover');
}
function onDragLeave(): void {
  dropZoneRef.value?.classList.remove('dragover');
}
function onDrop(e: DragEvent): void {
  e.preventDefault();
  dropZoneRef.value?.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) confirmLoad(() => loadFile(file));
}
function onPaste(e: ClipboardEvent): void {
  if (!e.clipboardData) return;
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  const file = item.getAsFile();
  if (file) confirmLoad(() => loadFile(file));
}

// ── lifecycle ──────────────────────────────────────────────
onMounted(() => {
  const c = canvasRef.value;
  if (c) ctx = c.getContext('2d', { willReadFrequently: true });
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('paste', onPaste);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('paste', onPaste);
  cleanup();
});

// re-render whenever any render input changes (regions, selection, scale, mode,
// live-draw rect). watchEffect tracks every reactive read inside render().
watchEffect(render);

// when a new image loads, size the canvas; the watchEffect above paints it.
watchEffect(() => {
  if (store.hasImage) fitCanvas();
});
</script>

<template>
  <div ref="wrapRef" class="canvas-wrap" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <div v-show="!store.hasImage" ref="dropZoneRef" class="drop-zone">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <h2>{{ $t('dropzone.title') }}</h2>
      <p>{{ $t('dropzone.browse') }}</p>
      <p class="hint">{{ $t('dropzone.hint') }}</p>
    </div>
    <canvas
      v-show="store.hasImage"
      ref="canvasRef"
      class="main-canvas"
      @mousedown="onMousedown"
      @mousemove="onHover"
    />
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
  transition: border-color 0.2s, background 0.2s;
  text-align: center;
}
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
}
</style>
