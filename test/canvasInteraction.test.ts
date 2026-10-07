import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useEditorStore } from '../src/stores/editor';
import { useCanvasInteraction } from '../src/composables/useCanvasInteraction';
import { fakeImage } from './helpers/canvas';

describe('useCanvasInteraction', () => {
  let store: ReturnType<typeof useEditorStore>;
  let canvas: HTMLCanvasElement;
  let ci: ReturnType<typeof useCanvasInteraction>;

  // jsdom's getBoundingClientRect is all zeros, so client coords == canvas coords
  const mouse = (type: string, x: number, y: number, init: MouseEventInit = {}) =>
    new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...init });

  function down(x: number, y: number, init: MouseEventInit = {}) {
    ci.onMousedown(mouse('mousedown', x, y, init));
  }
  function move(x: number, y: number) {
    window.dispatchEvent(mouse('mousemove', x, y));
  }
  function up(x: number, y: number) {
    window.dispatchEvent(mouse('mouseup', x, y));
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useEditorStore();
    store.loadImage(fakeImage(100, 100));
    canvas = document.createElement('canvas');
    ci = useCanvasInteraction(ref(canvas), store);
  });

  afterEach(() => ci.cleanup());

  it('draws a region from a left-button drag', () => {
    down(10, 10);
    expect(store.mode).toBe('draw');
    move(50, 40);
    up(50, 40);
    expect(store.mode).toBe('idle');
    expect(store.regions).toHaveLength(1);
    expect(store.regions[0]).toMatchObject({ x: 10, y: 10, w: 40, h: 30 });
  });

  it('converts screen coordinates to image space using the zoom', () => {
    store.setScale(0.5);
    down(10, 10);
    move(30, 40);
    up(30, 40);
    expect(store.regions[0]).toMatchObject({ x: 20, y: 20, w: 40, h: 60 });
  });

  it('ignores drags of 6px or less', () => {
    down(10, 10);
    move(16, 30);
    up(16, 30);
    expect(store.regions).toHaveLength(0);
  });

  it('ignores right and middle clicks', () => {
    for (const button of [1, 2]) {
      down(10, 10, { button });
      expect(store.mode).toBe('idle');
      move(60, 60);
      up(60, 60);
    }
    expect(store.regions).toHaveLength(0);
  });

  it('clips a rect dragged past the image edge', () => {
    down(90, 90);
    move(150, 150);
    up(150, 150);
    expect(store.regions[0]).toMatchObject({ x: 90, y: 90, w: 10, h: 10 });
  });

  it('moves a region by dragging its body', () => {
    store.addRegion({ x: 10, y: 10, w: 20, h: 20, effect: 'blur', strength: 8 });
    store.clearSelection();
    down(15, 15);
    expect(store.mode).toBe('move');
    move(25, 20);
    up(25, 20);
    expect(store.regions[0]).toMatchObject({ x: 20, y: 15 });
    store.undo();
    expect(store.regions[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('resizes the single selected region from a handle', () => {
    store.addRegion({ x: 10, y: 10, w: 20, h: 20, effect: 'blur', strength: 8 });
    down(30, 30); // se handle
    expect(store.mode).toBe('resize');
    move(40, 35);
    up(40, 35);
    expect(store.regions[0]).toMatchObject({ x: 10, y: 10, w: 30, h: 25 });
  });

  it('a plain click on a region does not create an undo step', () => {
    store.addRegion({ x: 10, y: 10, w: 20, h: 20, effect: 'blur', strength: 8 });
    const before = store.history.length;
    down(15, 15);
    up(15, 15);
    expect(store.history).toHaveLength(before);
  });

  it('shift-click toggles a region in the selection', () => {
    store.addRegion({ x: 0, y: 0, w: 20, h: 20, effect: 'blur', strength: 8 });
    store.addRegion({ x: 50, y: 50, w: 20, h: 20, effect: 'blur', strength: 8 });
    down(5, 5, { shiftKey: true });
    up(5, 5);
    expect(store.selectedIds).toEqual([2, 1]);
  });

  it('stops listening to the window after mouseup', () => {
    down(10, 10);
    move(50, 50);
    up(50, 50);
    const r = { ...store.regions[0] };
    move(90, 90);
    up(90, 90);
    expect(store.regions).toHaveLength(1);
    expect(store.regions[0]).toEqual(r);
  });

  it('hover shows resize, move and crosshair cursors', () => {
    store.addRegion({ x: 10, y: 10, w: 40, h: 40, effect: 'blur', strength: 8 });
    ci.onHover(mouse('mousemove', 50, 50));
    expect(canvas.style.cursor).toBe('se-resize');
    ci.onHover(mouse('mousemove', 30, 10));
    expect(canvas.style.cursor).toBe('n-resize');
    ci.onHover(mouse('mousemove', 30, 30));
    expect(canvas.style.cursor).toBe('move');
    ci.onHover(mouse('mousemove', 80, 80));
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('does nothing without an image', () => {
    setActivePinia(createPinia());
    store = useEditorStore();
    ci = useCanvasInteraction(ref(canvas), store);
    down(10, 10);
    expect(store.mode).toBe('idle');
  });
});
