import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Effect, Region } from '../types';
import { cloneRegions } from '../types';
import type { Handle } from '../lib/geometry';
import { resizeRect } from '../lib/geometry';

const HISTORY_CAP = 60;
const MIN_STRENGTH = 2;
const MAX_STRENGTH = 40;

export interface DragSnapshot {
  corner: Handle;
  startRect: Region;
}

export const useEditorStore = defineStore('editor', () => {
  // ── state ──────────────────────────────────────────────
  const image = ref<HTMLImageElement | null>(null);
  const imageSize = ref({ w: 0, h: 0 });
  const scale = ref(1);

  const regions = ref<Region[]>([]);
  const selectedIds = ref<number[]>([]);
  const nextId = ref(1);

  const history = ref<Region[][]>([]);
  const future = ref<Region[][]>([]);

  const mode = ref<'idle' | 'draw' | 'move' | 'resize'>('idle');

  /** Toolbar widget value; doubles as default for new draws and as the editor
   *  for the current selection (mirrors the original selEffect/selStrength). */
  const controlEffect = ref<Effect>('blur');
  const controlStrength = ref(8);

  // transient drag state, owned by the store so action handlers can read it
  let dragSnapshot: DragSnapshot | null = null;
  let moveStartRects: Region[] | null = null;

  // ── getters ────────────────────────────────────────────
  const hasImage = computed(() => image.value !== null);
  const hasRegions = computed(() => regions.value.length > 0);
  const canUndo = computed(() => history.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);
  const selectedCount = computed(() => selectedIds.value.length);

  const selectedRegions = computed(() =>
    regions.value.filter((r) => selectedIds.value.includes(r.id)),
  );

  const singleSelected = computed<Region | null>(() =>
    selectedIds.value.length === 1
      ? regions.value.find((r) => r.id === selectedIds.value[0]) ?? null
      : null,
  );

  // ── selection helpers ──────────────────────────────────
  function isSelected(id: number): boolean {
    return selectedIds.value.includes(id);
  }

  function setSelection(ids: number[]): void {
    selectedIds.value = ids;
    syncControls();
  }

  function clearSelection(): void {
    selectedIds.value = [];
    syncControls();
  }

  /** Single selection → mirror the region's effect/strength into the toolbar
   *  controls. Multi/none → leave the controls at their last value (so they
   *  keep serving as the default for the next draw), matching the original. */
  function syncControls(): void {
    if (selectedIds.value.length === 1) {
      const r = regions.value.find((reg) => reg.id === selectedIds.value[0]);
      if (r) {
        controlEffect.value = r.effect;
        controlStrength.value = r.strength;
      }
    }
  }

  // ── history ─────────────────────────────────────────────
  function pushHistory(): void {
    history.value.push(cloneRegions(regions.value));
    if (history.value.length > HISTORY_CAP) history.value.shift();
  }

  function clearFuture(): void {
    future.value = [];
  }

  // ── image ───────────────────────────────────────────────
  function loadImage(img: HTMLImageElement): void {
    image.value = img;
    imageSize.value = { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
    regions.value = [];
    selectedIds.value = [];
    history.value = [];
    future.value = [];
    nextId.value = 1;
    mode.value = 'idle';
    controlEffect.value = 'blur';
    controlStrength.value = 8;
    dragSnapshot = null;
    moveStartRects = null;
  }

  function setScale(s: number): void {
    scale.value = s;
  }

  // ── region mutations ────────────────────────────────────
  function addRegion(rect: Omit<Region, 'id'>): void {
    pushHistory();
    const r: Region = { ...rect, id: nextId.value++ };
    regions.value.push(r);
    selectedIds.value = [r.id];
    clearFuture();
  }

  /** Snapshot current state once at the start of a move drag (called on
   *  mousedown). Per-mousemove `moveSelected` mutates without snapshotting. */
  function beginMoveDrag(): void {
    pushHistory();
    moveStartRects = selectedRegions.value.map((r) => ({ ...r }));
  }

  function moveSelected(dxImg: number, dyImg: number): void {
    if (!moveStartRects) return;
    for (const sr of moveStartRects) {
      const r = regions.value.find((reg) => reg.id === sr.id);
      if (r) {
        r.x = sr.x + dxImg;
        r.y = sr.y + dyImg;
      }
    }
  }

  function beginResizeDrag(corner: Handle): void {
    const r = singleSelected.value;
    if (!r) return;
    pushHistory();
    dragSnapshot = { corner, startRect: { ...r } };
  }

  function resizeSelected(dxImg: number, dyImg: number): void {
    if (!dragSnapshot) return;
    const r = regions.value.find((reg) => reg.id === dragSnapshot!.startRect.id);
    if (!r) return;
    const next = resizeRect(dragSnapshot.startRect, dragSnapshot.corner, dxImg, dyImg);
    r.x = next.x;
    r.y = next.y;
    r.w = next.w;
    r.h = next.h;
  }

  /** Commit a move/resize drag: clears the redo stack. Draw commits via
   *  `addRegion` which clears it itself. */
  function endDrag(): void {
    dragSnapshot = null;
    moveStartRects = null;
    clearFuture();
  }

  function setEffect(effect: Effect): void {
    controlEffect.value = effect;
    if (selectedIds.value.length === 0) return;
    pushHistory();
    for (const id of selectedIds.value) {
      const r = regions.value.find((reg) => reg.id === id);
      if (r) r.effect = effect;
    }
    clearFuture();
  }

  function setStrength(strength: number): void {
    const v = Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(strength)));
    controlStrength.value = v;
    if (selectedIds.value.length === 0) return;
    pushHistory();
    for (const id of selectedIds.value) {
      const r = regions.value.find((reg) => reg.id === id);
      if (r) r.strength = v;
    }
    clearFuture();
  }

  // ── selection actions ──────────────────────────────────
  function select(id: number, shift = false): void {
    if (shift) {
      if (isSelected(id)) {
        selectedIds.value = selectedIds.value.filter((x) => x !== id);
      } else {
        selectedIds.value = [...selectedIds.value, id];
      }
    } else {
      selectedIds.value = [id];
    }
    syncControls();
  }

  function selectAll(): void {
    selectedIds.value = regions.value.map((r) => r.id);
    syncControls();
  }

  function deleteSelected(): void {
    if (selectedIds.value.length === 0) return;
    pushHistory();
    const ids = new Set(selectedIds.value);
    regions.value = regions.value.filter((r) => !ids.has(r.id));
    selectedIds.value = [];
    clearFuture();
  }

  function deleteRegion(id: number): void {
    pushHistory();
    regions.value = regions.value.filter((r) => r.id !== id);
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
    clearFuture();
  }

  function clearAll(): void {
    if (regions.value.length === 0) return;
    pushHistory();
    regions.value = [];
    selectedIds.value = [];
    clearFuture();
  }

  // ── undo / redo ─────────────────────────────────────────
  function undo(): void {
    if (history.value.length === 0) return;
    future.value.push(cloneRegions(regions.value));
    regions.value = history.value.pop()!;
    selectedIds.value = [];
    mode.value = 'idle';
  }

  function redo(): void {
    if (future.value.length === 0) return;
    history.value.push(cloneRegions(regions.value));
    regions.value = future.value.pop()!;
    selectedIds.value = [];
    mode.value = 'idle';
  }

  return {
    // state
    image,
    imageSize,
    scale,
    regions,
    selectedIds,
    nextId,
    history,
    future,
    mode,
    controlEffect,
    controlStrength,
    // getters
    hasImage,
    hasRegions,
    canUndo,
    canRedo,
    selectedCount,
    selectedRegions,
    singleSelected,
    // selection
    isSelected,
    setSelection,
    clearSelection,
    select,
    selectAll,
    syncControls,
    // history
    pushHistory,
    undo,
    redo,
    // image
    loadImage,
    setScale,
    // mutations
    addRegion,
    beginMoveDrag,
    moveSelected,
    beginResizeDrag,
    resizeSelected,
    endDrag,
    setEffect,
    setStrength,
    deleteSelected,
    deleteRegion,
    clearAll,
  };
});
