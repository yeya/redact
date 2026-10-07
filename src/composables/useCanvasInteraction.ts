import { ref, computed, type Ref } from 'vue';
import type { useEditorStore } from '../stores/editor';
import { hitHandle, hitRect, screenToImage, type Point } from '../lib/geometry';

interface DrawDrag {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CURSORS: Record<string, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
};

type Store = ReturnType<typeof useEditorStore>;

/**
 * Canvas mouse interaction, structurally fixing the original's bug where an
 * unconditional global `mouseup` stomped sidebar-driven selection changes:
 * here the window `mousemove`/`mouseup` listeners are attached **only** for
 * the duration of a drag that started on the canvas, so a click in the sidebar
 * never reaches this handler. `dragOnCanvas` is kept as a belt-and-suspenders
 * guard matching the original's intent.
 */
export function useCanvasInteraction(canvasRef: Ref<HTMLCanvasElement | null>, store: Store) {
  const drag = ref<DrawDrag | null>(null);
  let dragOnCanvas = false;
  let moveStart: Point = { x: 0, y: 0 };

  function getPos(e: MouseEvent): Point {
    const b = canvasRef.value!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  function onMousedown(e: MouseEvent): void {
    if (!store.hasImage) return;
    e.preventDefault();
    dragOnCanvas = true;
    const { x, y } = getPos(e);
    const shift = e.shiftKey;

    // resize handle — single selection only
    if (store.selectedIds.length === 1) {
      const r = store.singleSelected;
      if (r) {
        const corner = hitHandle(x, y, r, store.scale);
        if (corner) {
          store.beginResizeDrag(corner);
          store.mode = 'resize';
          moveStart = { x, y };
          attachWindowListeners();
          return;
        }
      }
    }

    // region body — select (shift toggles) and start a move
    const hit = hitRect(x, y, store.regions, store.scale);
    if (hit) {
      store.select(hit.id, shift);
      store.beginMoveDrag();
      store.mode = 'move';
      moveStart = { x, y };
      attachWindowListeners();
      return;
    }

    // empty canvas — start a new draw rect (deselect unless shift)
    if (!shift) store.clearSelection();
    store.mode = 'draw';
    drag.value = { x0: x, y0: y, x1: x, y1: y };
    moveStart = { x, y };
    attachWindowListeners();
  }

  function onMousemove(e: MouseEvent): void {
    if (store.mode === 'idle') return;
    const { x, y } = getPos(e);

    if (store.mode === 'draw' && drag.value) {
      drag.value.x1 = x;
      drag.value.y1 = y;
      return;
    }
    if (store.mode === 'move') {
      store.moveSelected((x - moveStart.x) / store.scale, (y - moveStart.y) / store.scale);
      return;
    }
    if (store.mode === 'resize') {
      store.resizeSelected((x - moveStart.x) / store.scale, (y - moveStart.y) / store.scale);
      return;
    }
  }

  function onMouseup(): void {
    if (!dragOnCanvas) {
      detachWindowListeners();
      return;
    }
    dragOnCanvas = false;

    if (store.mode === 'draw' && drag.value) {
      const { x0, y0, x1, y1 } = drag.value;
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (w > 6 && h > 6) {
        const origin = screenToImage(Math.min(x0, x1), Math.min(y0, y1), store.scale);
        store.addRegion({
          x: origin.x,
          y: origin.y,
          w: w / store.scale,
          h: h / store.scale,
          effect: store.controlEffect,
          strength: store.controlStrength,
        });
      }
      drag.value = null;
    } else if (store.mode === 'move' || store.mode === 'resize') {
      store.endDrag();
    }
    store.mode = 'idle';
    detachWindowListeners();
  }

  /** Idle cursor feedback: resize cursor over a handle, move over a body. */
  function onHover(e: MouseEvent): void {
    if (!store.hasImage || store.mode !== 'idle') return;
    const canvas = canvasRef.value;
    if (!canvas) return;
    const { x, y } = getPos(e);
    if (store.selectedIds.length === 1) {
      const r = store.singleSelected;
      if (r) {
        const c = hitHandle(x, y, r, store.scale);
        if (c) {
          canvas.style.cursor = CURSORS[c];
          return;
        }
      }
    }
    canvas.style.cursor = hitRect(x, y, store.regions, store.scale) ? 'move' : 'crosshair';
  }

  let winMove: ((e: MouseEvent) => void) | null = null;
  let winUp: ((e: MouseEvent) => void) | null = null;

  function attachWindowListeners(): void {
    winMove = onMousemove;
    winUp = onMouseup;
    window.addEventListener('mousemove', winMove);
    window.addEventListener('mouseup', winUp);
  }

  function detachWindowListeners(): void {
    if (winMove) {
      window.removeEventListener('mousemove', winMove);
      winMove = null;
    }
    if (winUp) {
      window.removeEventListener('mouseup', winUp);
      winUp = null;
    }
  }

  /** The live draw rectangle in screen pixels, for the render loop. */
  const liveRect = computed(() => drag.value);

  return {
    onMousedown,
    onHover,
    liveRect,
    cleanup: detachWindowListeners,
  };
}
