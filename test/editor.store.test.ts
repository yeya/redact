import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useEditorStore, MIN_STRENGTH, MAX_STRENGTH, DEFAULT_STRENGTH } from '../src/stores/editor';
import type { Region } from '../src/types';

const fakeImg = { naturalWidth: 100, naturalHeight: 50, width: 100, height: 50 } as unknown as HTMLImageElement;

function addRegionAt(store: ReturnType<typeof useEditorStore>, x: number, y: number): Region {
  const before = store.regions.length;
  store.addRegion({ x, y, w: 10, h: 10, effect: 'blur', strength: 8 });
  return store.regions[before];
}

describe('editor store', () => {
  let store: ReturnType<typeof useEditorStore>;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useEditorStore();
  });

  describe('addRegion / history / future', () => {
    it('adds a region with a fresh id, selects it, pushes history, clears future', () => {
      store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 8 });
      expect(store.regions).toHaveLength(1);
      expect(store.regions[0].id).toBe(1);
      expect(store.selectedIds).toEqual([1]);
      expect(store.history).toHaveLength(1);
      expect(store.future).toHaveLength(0);

      // create a redo entry, then a new mutation should clear it
      store.undo();
      store.redo();
      store.undo();
      expect(store.future).toHaveLength(1);
      store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 8 });
      expect(store.future).toHaveLength(0);
      store.addRegion({ x: 20, y: 20, w: 5, h: 5, effect: 'blur', strength: 8 });
      // ids are never reused, even for a region that was undone
      expect(store.regions.map((r) => r.id)).toEqual([2, 3]);
    });
  });

  describe('undo / redo', () => {
    it('undo restores previous state and clears selection', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 20, 20);
      store.selectAll();
      expect(store.selectedIds).toHaveLength(2);
      store.undo();
      expect(store.regions).toHaveLength(1);
      expect(store.selectedIds).toHaveLength(0);
      store.undo();
      expect(store.regions).toHaveLength(0);
      expect(store.canUndo).toBe(false);
    });

    it('redo replays a undone mutation', () => {
      addRegionAt(store, 0, 0);
      store.undo();
      expect(store.regions).toHaveLength(0);
      store.redo();
      expect(store.regions).toHaveLength(1);
      expect(store.canRedo).toBe(false);
    });

    it('a new mutation after undo clears the redo stack', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 20, 20);
      store.undo(); // back to 1 region
      expect(store.canRedo).toBe(true);
      addRegionAt(store, 30, 30); // new mutation
      expect(store.canRedo).toBe(false);
    });
  });

  describe('history cap', () => {
    it('caps history at 60 entries', () => {
      for (let i = 0; i < 65; i++) addRegionAt(store, i, 0);
      expect(store.history.length).toBe(60);
    });
  });

  describe('selection', () => {
    it('shift-click toggles membership', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 10, 10);
      addRegionAt(store, 20, 20);
      store.select(1);
      store.select(2, true);
      expect(store.selectedIds).toEqual([1, 2]);
      store.select(1, true);
      expect(store.selectedIds).toEqual([2]);
    });

    it('select without shift replaces', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 10, 10);
      store.select(1);
      store.select(2, true);
      store.select(1);
      expect(store.selectedIds).toEqual([1]);
    });

    it('selectAll / clearSelection', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 10, 10);
      store.selectAll();
      expect(store.selectedIds).toHaveLength(2);
      store.clearSelection();
      expect(store.selectedIds).toHaveLength(0);
    });

    it('syncControls mirrors a single-selected region into the controls', () => {
      addRegionAt(store, 0, 0);
      const r = store.regions[0];
      r.effect = 'pixelate';
      r.strength = 20;
      store.select(r.id);
      expect(store.controlEffect).toBe('pixelate');
      expect(store.controlStrength).toBe(20);
    });
  });

  describe('deletion', () => {
    it('deleteSelected removes selected regions and clears selection', () => {
      addRegionAt(store, 0, 0); // id 1
      addRegionAt(store, 10, 10); // id 2
      addRegionAt(store, 20, 20); // id 3 (auto-selected)
      store.select(1); // replace selection with [1]
      store.select(3, true); // toggle 3 in → [1, 3]
      store.deleteSelected();
      expect(store.regions.map((r) => r.id)).toEqual([2]);
      expect(store.selectedIds).toHaveLength(0);
      // 3 adds + 1 delete each pushed history
      expect(store.history).toHaveLength(4);
    });

    it('deleteSelected is undoable', () => {
      addRegionAt(store, 0, 0);
      store.deleteSelected();
      expect(store.regions).toHaveLength(0);
      store.undo();
      expect(store.regions).toHaveLength(1);
    });

    it('deleteRegion removes one and drops it from selection', () => {
      addRegionAt(store, 0, 0); // id 1
      addRegionAt(store, 10, 10); // id 2 (auto-selected)
      store.select(1); // → [1]
      store.select(2, true); // → [1, 2]
      store.deleteRegion(1);
      expect(store.regions.map((r) => r.id)).toEqual([2]);
      expect(store.selectedIds).toEqual([2]);
    });

    it('clearAll wipes regions (undoable)', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 10, 10);
      store.clearAll();
      expect(store.regions).toHaveLength(0);
      store.undo();
      expect(store.regions).toHaveLength(2);
    });
  });

  describe('move / resize', () => {
    it('moveSelected applies an image-space delta to all selected', () => {
      const r = addRegionAt(store, 10, 10);
      store.beginMoveDrag();
      store.moveSelected(5, 7);
      expect(r.x).toBe(15);
      expect(r.y).toBe(17);
      store.endDrag();
    });

    it('move is undoable (snapshot taken at drag start)', () => {
      addRegionAt(store, 10, 10);
      store.beginMoveDrag();
      store.moveSelected(5, 5);
      store.endDrag();
      expect(store.regions[0].x).toBe(15);
      store.undo();
      // undo swaps in a fresh cloned array, so read from the store, not the
      // captured region reference
      expect(store.regions[0].x).toBe(10);
    });

    it('resizeSelected adjusts edges with a min size of 4', () => {
      const r = addRegionAt(store, 10, 10);
      r.w = 20;
      r.h = 20;
      store.beginResizeDrag('se');
      store.resizeSelected(5, 5);
      expect(r.w).toBe(25);
      expect(r.h).toBe(25);
      store.endDrag();
    });

    it('resize clamps to min 4', () => {
      const r = addRegionAt(store, 10, 10);
      r.w = 20;
      r.h = 20;
      store.beginResizeDrag('se');
      store.resizeSelected(-18, -18);
      expect(r.w).toBe(4);
      expect(r.h).toBe(4);
      store.endDrag();
    });
  });

  describe('setEffect / setStrength (undoable)', () => {
    it('setEffect applies to all selected and is undoable', () => {
      addRegionAt(store, 0, 0);
      store.setEffect('pixelate');
      expect(store.regions[0].effect).toBe('pixelate');
      store.undo();
      expect(store.regions[0].effect).toBe('blur');
    });

    it('setStrength applies to all selected, clamps to [MIN,MAX], and is undoable', () => {
      addRegionAt(store, 0, 0);
      store.setStrength(99);
      expect(store.regions[0].strength).toBe(MAX_STRENGTH);
      store.setStrength(1);
      expect(store.regions[0].strength).toBe(MIN_STRENGTH);
      // consecutive strength changes coalesce into a single undo step
      store.undo();
      expect(store.regions[0].strength).toBe(8);
    });

    it('with no selection, setEffect/setStrength only update the control default', () => {
      store.setEffect('pixelate');
      store.setStrength(20);
      expect(store.controlEffect).toBe('pixelate');
      expect(store.controlStrength).toBe(20);
      expect(store.regions).toHaveLength(0);
      expect(store.history).toHaveLength(0);
    });
  });

  describe('undo granularity', () => {
    it('a burst of setStrength calls (one slider drag) is a single undo step', () => {
      addRegionAt(store, 0, 0);
      const before = store.history.length;
      for (let v = 9; v <= 30; v++) store.setStrength(v);
      expect(store.history).toHaveLength(before + 1);
      store.undo();
      expect(store.regions[0].strength).toBe(8);
    });

    it('commitEdit ends the burst so the next slider drag is its own step', () => {
      addRegionAt(store, 0, 0);
      const before = store.history.length;
      store.setStrength(20);
      store.setStrength(25);
      store.commitEdit();
      store.setStrength(30);
      expect(store.history).toHaveLength(before + 2);
      store.undo();
      expect(store.regions[0].strength).toBe(25);
      store.undo();
      expect(store.regions[0].strength).toBe(8);
    });

    it('a strength burst does not merge across a selection change', () => {
      addRegionAt(store, 0, 0); // id 1
      addRegionAt(store, 20, 20); // id 2
      const before = store.history.length;
      store.select(1);
      store.setStrength(20);
      store.select(2);
      store.setStrength(30);
      expect(store.history).toHaveLength(before + 2);
    });

    it('setEffect to the current value does not create an undo step', () => {
      addRegionAt(store, 0, 0);
      const before = store.history.length;
      store.setEffect('blur');
      expect(store.history).toHaveLength(before);
    });

    it('clicking a region without dragging leaves history and redo intact', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 20, 20);
      store.undo();
      const before = store.history.length;
      store.select(1);
      store.beginMoveDrag();
      store.endDrag();
      expect(store.history).toHaveLength(before);
      expect(store.canRedo).toBe(true);
    });

    it('clicking a resize handle without dragging leaves history and redo intact', () => {
      addRegionAt(store, 0, 0);
      addRegionAt(store, 20, 20);
      store.undo();
      const before = store.history.length;
      store.select(1);
      store.beginResizeDrag('se');
      store.endDrag();
      expect(store.history).toHaveLength(before);
      expect(store.canRedo).toBe(true);
    });

    it('undo during a drag aborts the drag instead of corrupting history', () => {
      addRegionAt(store, 10, 10);
      store.beginMoveDrag();
      store.moveSelected(5, 5);
      store.undo();
      expect(store.regions).toHaveLength(1);
      expect(store.regions[0].x).toBe(10);
      store.moveSelected(9, 9); // stray mousemove after the abort
      store.endDrag();
      expect(store.regions[0].x).toBe(10);
      expect(store.history).toHaveLength(1);
    });
  });

  describe('clamping to the image', () => {
    beforeEach(() => store.loadImage(fakeImg)); // 100×50

    it('move keeps the whole selection inside the image, preserving layout', () => {
      store.addRegion({ x: 10, y: 10, w: 10, h: 10, effect: 'blur', strength: 8 });
      store.addRegion({ x: 30, y: 20, w: 10, h: 10, effect: 'blur', strength: 8 });
      store.selectAll();
      store.beginMoveDrag();
      store.moveSelected(500, 500);
      expect(store.regions.map((r) => [r.x, r.y])).toEqual([
        [70, 30],
        [90, 40],
      ]);
      store.moveSelected(-500, -500);
      expect(store.regions.map((r) => [r.x, r.y])).toEqual([
        [0, 0],
        [20, 10],
      ]);
      store.endDrag();
    });

    it('resize stops at the image edges', () => {
      store.addRegion({ x: 10, y: 10, w: 20, h: 20, effect: 'blur', strength: 8 });
      store.beginResizeDrag('se');
      store.resizeSelected(500, 500);
      expect(store.regions[0]).toMatchObject({ x: 10, y: 10, w: 90, h: 40 });
      store.endDrag();
      store.beginResizeDrag('nw');
      store.resizeSelected(-500, -500);
      expect(store.regions[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 50 });
      store.endDrag();
    });

    it('addRegion clips a rect drawn past the edge', () => {
      store.addRegion({ x: -5, y: 40, w: 20, h: 20, effect: 'blur', strength: 8 });
      expect(store.regions[0]).toMatchObject({ x: 0, y: 40, w: 15, h: 10 });
    });

    it('addRegion ignores a rect entirely outside the image', () => {
      store.addRegion({ x: 200, y: 0, w: 20, h: 20, effect: 'blur', strength: 8 });
      expect(store.regions).toHaveLength(0);
      expect(store.history).toHaveLength(0);
    });
  });

  describe('loadImage', () => {
    it('resets regions, history, future, selection, ids and controls', () => {
      addRegionAt(store, 0, 0);
      store.setEffect('pixelate');
      expect(store.history.length).toBeGreaterThan(0);
      store.loadImage(fakeImg);
      expect(store.hasImage).toBe(true);
      expect(store.imageSize).toEqual({ w: 100, h: 50 });
      expect(store.regions).toHaveLength(0);
      expect(store.selectedIds).toHaveLength(0);
      expect(store.history).toHaveLength(0);
      expect(store.future).toHaveLength(0);
      expect(store.nextId).toBe(1);
      expect(store.controlEffect).toBe('blur');
      expect(store.controlStrength).toBe(DEFAULT_STRENGTH);
    });
  });
});
