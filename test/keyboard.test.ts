import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useEditorStore } from '../src/stores/editor';
import { useKeyboard } from '../src/composables/useKeyboard';
import { useConfirm } from '../src/composables/useConfirm';

function press(key: string, code: string, opts: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...opts });
  window.dispatchEvent(e);
  return e;
}

describe('useKeyboard', () => {
  let store: ReturnType<typeof useEditorStore>;
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useEditorStore();
    const Host = defineComponent({
      setup() {
        useKeyboard(useEditorStore());
        return () => null;
      },
    });
    wrapper = mount(Host, { global: { plugins: [pinia] } });
    store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 8 });
    store.addRegion({ x: 20, y: 20, w: 10, h: 10, effect: 'blur', strength: 8 });
  });

  afterEach(() => {
    useConfirm().cancel();
    wrapper.unmount();
  });

  it('Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo', () => {
    press('z', 'KeyZ', { ctrlKey: true });
    expect(store.regions).toHaveLength(1);
    press('y', 'KeyY', { ctrlKey: true });
    expect(store.regions).toHaveLength(2);
    press('z', 'KeyZ', { metaKey: true });
    press('Z', 'KeyZ', { metaKey: true, shiftKey: true });
    expect(store.regions).toHaveLength(2);
  });

  it('Ctrl+A selects all, Escape clears, Delete removes the selection', () => {
    press('a', 'KeyA', { ctrlKey: true });
    expect(store.selectedIds).toEqual([1, 2]);
    press('Escape', 'Escape');
    expect(store.selectedIds).toEqual([]);
    store.select(1);
    press('Delete', 'Delete');
    expect(store.regions.map((r) => r.id)).toEqual([2]);
  });

  it('works on a non-Latin keyboard layout (matches the physical key)', () => {
    // Hebrew layout: the Z key produces "ז"
    press('ז', 'KeyZ', { ctrlKey: true });
    expect(store.regions).toHaveLength(1);
    press('ש', 'KeyA', { ctrlKey: true });
    expect(store.selectedIds).toEqual([1]);
  });

  it('ignores editor shortcuts while the confirm dialog is open', () => {
    void useConfirm().confirm({ title: 't', message: 'm' });
    store.selectAll();
    press('Delete', 'Delete');
    press('z', 'KeyZ', { ctrlKey: true });
    press('Escape', 'Escape');
    expect(store.regions).toHaveLength(2);
    expect(store.canRedo).toBe(false);
  });

  it('ignores keys while typing in a form field', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    store.selectAll();
    press('Backspace', 'Backspace');
    expect(store.regions).toHaveLength(2);
    input.remove();
  });
});
