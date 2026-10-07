import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import type { Effect, Rect, Region } from '../types';
import { cloneRegions } from '../types';
import type { Handle } from '../lib/geometry';
import { clampGroupDelta, clipRect, resizeRect } from '../lib/geometry';

const HISTORY_CAP = 60;
/** Strength is the pixelate block size / blur radius in IMAGE pixels. Below
 *  ~6px, text under blur or pixelate stays legible or is recoverable. */
export const MIN_STRENGTH = 6;
export const MAX_STRENGTH = 40;
export const DEFAULT_STRENGTH = 12;
export const DEFAULT_EFFECT: Effect = 'blur';
/** Effects that obscure rather than remove pixels, and can sometimes be reversed. */
export const REVERSIBLE_EFFECTS: readonly Effect[] = ['blur', 'pixelate', 'frosted'];

export type EditorMode = 'idle' | 'draw' | 'move' | 'resize';

/** Transient state for an in-progress move/resize drag. */
interface DragState {
  /** Regions as they were before the drag — becomes the undo step if anything changed. */
  before: Region[];
  /** The dragged region(s) at drag start; deltas are applied to these. */
  startRects: Region[];
  corner: Handle | null;
}

function sameRegions(a: Region[], b: Region[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i];
      return (
        r.id === o.id &&
        r.x === o.x &&
        r.y === o.y &&
        r.w === o.w &&
        r.h === o.h &&
        r.effect === o.effect &&
        r.strength === o.strength
      );
    })
  );
}

export const useEditorStore = defineStore('editor', () => {
  // ── state ──────────────────────────────────────────────
  // DOM element and history snapshots never need deep reactivity.
  const image = shallowRef<HTMLImageElement | null>(null);
  const imageSize = ref({ w: 0, h: 0 });
  const scale = ref(1);

  const regions = ref<Region[]>([]);
  const selectedIds = ref<number[]>([]);
  const nextId = ref(1);

  const history = shallowRef<Region[][]>([]);
  const future = shallowRef<Region[][]>([]);

  const mode = ref<EditorMode>('idle');

  /** Toolbar widget value; doubles as default for new draws and as the editor
   *  for the current selection (mirrors the original selEffect/selStrength). */
  const controlEffect = ref<Effect>(DEFAULT_EFFECT);
  const controlStrength = ref(DEFAULT_STRENGTH);

  // transient drag state, owned by the store so action handlers can read it
  let drag: DragState | null = null;
  /** Key of the edit currently being coalesced into one undo step (e.g. a
   *  slider drag). Any other mutation, selection change or undo resets it. */
  let editGroup: string | null = null;

  // ── getters ────────────────────────────────────────────
  const hasImage = computed(() => image.value !== null);
  const hasRegions = computed(() => regions.value.length > 0);
  const canUndo = computed(() => history.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);
  const selectedCount = computed(() => selectedIds.value.length);

  const selectedRegions = computed(() => regions.value.filter((r) => selectedIds.value.includes(r.id)));

  const singleSelected = computed<Region | null>(() =>
    selectedIds.value.length === 1 ? (regions.value.find((r) => r.id === selectedIds.value[0]) ?? null) : null,
  );

  // ── selection helpers ──────────────────────────────────
  function isSelected(id: number): boolean {
    return selectedIds.value.includes(id);
  }

  function setSelectedIds(ids: number[]): void {
    selectedIds.value = ids;
    editGroup = null;
    syncControls();
  }

  function clearSelection(): void {
    setSelectedIds([]);
  }

  /** Single selection → mirror the region's effect/strength into the toolbar
   *  controls. Multi/none → leave the controls at their last value (so they
   *  keep serving as the default for the next draw), matching the original. */
  function syncControls(): void {
    const r = singleSelected.value;
    if (r) {
      controlEffect.value = r.effect;
      controlStrength.value = r.strength;
    }
  }

  // ── history ─────────────────────────────────────────────
  function pushHistory(snapshot: Region[]): void {
    history.value = [...history.value, snapshot].slice(-HISTORY_CAP);
  }

  /**
   * Record the current regions as an undo step, just before mutating them.
   * Consecutive calls with the same non-null `group` collapse into the first
   * step, so e.g. dragging the strength slider is one undo, not forty.
   */
  function record(group: string | null = null): void {
    if (group !== null && group === editGroup) return;
    pushHistory(cloneRegions(regions.value));
    future.value = [];
    editGroup = group;
  }

  /** End the current coalesced edit; the next change starts a new undo step. */
  function commitEdit(): void {
    editGroup = null;
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
    controlEffect.value = DEFAULT_EFFECT;
    controlStrength.value = DEFAULT_STRENGTH;
    drag = null;
    editGroup = null;
  }

  function setScale(s: number): void {
    scale.value = s;
  }

  /** Clip to the image, or pass through untouched when no image is loaded. */
  function clipToImage(r: Rect): Rect | null {
    const { w, h } = imageSize.value;
    return w > 0 && h > 0 ? clipRect(r, w, h) : r;
  }

  // ── region mutations ────────────────────────────────────
  /** Add a region (clipped to the image) and select it. A rect that lies
   *  entirely outside the image is ignored. */
  function addRegion(rect: Omit<Region, 'id'>): void {
    const clipped = clipToImage(rect);
    if (!clipped) return;
    record();
    const r: Region = { ...rect, ...clipped, id: nextId.value++ };
    regions.value.push(r);
    selectedIds.value = [r.id];
  }

  /** Mark the start of a draw drag (the region is added on mouseup). */
  function beginDraw(): void {
    mode.value = 'draw';
  }

  /** Start a move drag of the current selection (called on mousedown). The
   *  undo step is only recorded by `endDrag`, and only if something moved. */
  function beginMoveDrag(): void {
    drag = {
      before: cloneRegions(regions.value),
      startRects: selectedRegions.value.map((r) => ({ ...r })),
      corner: null,
    };
    mode.value = 'move';
  }

  function moveSelected(dxImg: number, dyImg: number): void {
    if (!drag || drag.corner) return;
    const { w, h } = imageSize.value;
    const d = w > 0 && h > 0 ? clampGroupDelta(drag.startRects, dxImg, dyImg, w, h) : { x: dxImg, y: dyImg };
    for (const sr of drag.startRects) {
      const r = regions.value.find((reg) => reg.id === sr.id);
      if (r) {
        r.x = sr.x + d.x;
        r.y = sr.y + d.y;
      }
    }
  }

  function beginResizeDrag(corner: Handle): void {
    const r = singleSelected.value;
    if (!r) return;
    drag = { before: cloneRegions(regions.value), startRects: [{ ...r }], corner };
    mode.value = 'resize';
  }

  function resizeSelected(dxImg: number, dyImg: number): void {
    if (!drag?.corner) return;
    const start = drag.startRects[0];
    const r = regions.value.find((reg) => reg.id === start.id);
    if (!r) return;
    const next = clipToImage(resizeRect(start, drag.corner, dxImg, dyImg));
    if (!next) return;
    r.x = next.x;
    r.y = next.y;
    r.w = next.w;
    r.h = next.h;
  }

  /** Finish any drag. A move/resize that changed something becomes one undo
   *  step (and clears redo); a plain click leaves history alone. */
  function endDrag(): void {
    if (drag && !sameRegions(drag.before, regions.value)) {
      pushHistory(drag.before);
      future.value = [];
      editGroup = null;
    }
    drag = null;
    mode.value = 'idle';
  }

  /** Abort an in-progress move/resize, restoring the pre-drag regions. */
  function cancelDrag(): void {
    if (drag) regions.value = drag.before;
    drag = null;
    mode.value = 'idle';
  }

  function setEffect(effect: Effect): void {
    controlEffect.value = effect;
    const targets = selectedRegions.value.filter((r) => r.effect !== effect);
    if (targets.length === 0) return;
    record();
    for (const r of targets) r.effect = effect;
  }

  function setStrength(strength: number): void {
    const v = Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(strength)));
    controlStrength.value = v;
    const targets = selectedRegions.value.filter((r) => r.strength !== v);
    if (targets.length === 0) return;
    record('strength');
    for (const r of targets) r.strength = v;
  }

  // ── selection actions ──────────────────────────────────
  function select(id: number, shift = false): void {
    if (!shift) setSelectedIds([id]);
    else if (isSelected(id)) setSelectedIds(selectedIds.value.filter((x) => x !== id));
    else setSelectedIds([...selectedIds.value, id]);
  }

  function selectAll(): void {
    setSelectedIds(regions.value.map((r) => r.id));
  }

  function deleteSelected(): void {
    if (selectedIds.value.length === 0) return;
    record();
    const ids = new Set(selectedIds.value);
    regions.value = regions.value.filter((r) => !ids.has(r.id));
    selectedIds.value = [];
  }

  function deleteRegion(id: number): void {
    if (!regions.value.some((r) => r.id === id)) return;
    record();
    regions.value = regions.value.filter((r) => r.id !== id);
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  }

  function clearAll(): void {
    if (regions.value.length === 0) return;
    record();
    regions.value = [];
    selectedIds.value = [];
  }

  // ── undo / redo ─────────────────────────────────────────
  /** Undo the last step. During a drag, undo aborts the drag instead. */
  function undo(): void {
    if (drag) {
      cancelDrag();
      return;
    }
    if (history.value.length === 0) return;
    future.value = [...future.value, cloneRegions(regions.value)];
    regions.value = history.value[history.value.length - 1];
    history.value = history.value.slice(0, -1);
    selectedIds.value = [];
    mode.value = 'idle';
    editGroup = null;
  }

  function redo(): void {
    if (drag) cancelDrag();
    if (future.value.length === 0) return;
    pushHistory(cloneRegions(regions.value));
    regions.value = future.value[future.value.length - 1];
    future.value = future.value.slice(0, -1);
    selectedIds.value = [];
    mode.value = 'idle';
    editGroup = null;
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
    clearSelection,
    select,
    selectAll,
    // history
    undo,
    redo,
    commitEdit,
    // image
    loadImage,
    setScale,
    // mutations
    addRegion,
    beginDraw,
    beginMoveDrag,
    moveSelected,
    beginResizeDrag,
    resizeSelected,
    endDrag,
    cancelDrag,
    setEffect,
    setStrength,
    deleteSelected,
    deleteRegion,
    clearAll,
  };
});
