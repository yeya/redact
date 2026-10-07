import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TheCanvas from '../src/components/TheCanvas.vue';
import { useEditorStore } from '../src/stores/editor';
import { useConfirm } from '../src/composables/useConfirm';
import { useToast } from '../src/composables/useToast';
import i18n from '../src/i18n';
import { contextFor, fakeImage, installCanvasMock, installRafMock } from './helpers/canvas';

describe('TheCanvas', () => {
  let wrapper: VueWrapper;
  let store: ReturnType<typeof useEditorStore>;
  let flushFrames: () => void;
  let wrapSize = { w: 1000, h: 800 };

  async function settle() {
    await nextTick();
    flushFrames();
    await nextTick();
    flushFrames();
  }

  beforeEach(async () => {
    installCanvasMock();
    ({ flushFrames } = installRafMock());
    wrapSize = { w: 1000, h: 800 };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => wrapSize.w);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => wrapSize.h);
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useEditorStore();
    wrapper = mount(TheCanvas, { global: { plugins: [pinia, i18n] }, attachTo: document.body });
    await settle();
  });

  afterEach(() => {
    useConfirm().cancel();
    wrapper.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function ctx() {
    return contextFor(wrapper.find('canvas').element as HTMLCanvasElement);
  }

  /** The canvas is blank if it was reset and nothing was drawn afterwards. */
  function isBlank(ops: string[]) {
    const lastReset = ops.lastIndexOf('reset');
    return lastReset !== -1 && ops.lastIndexOf('drawImage') < lastReset;
  }

  it('paints the image when it loads', async () => {
    store.loadImage(fakeImage(400, 300));
    await settle();
    expect(ctx().ops).toContain('drawImage');
    expect(isBlank(ctx().ops)).toBe(false);
  });

  it('is not left blank after a window resize that keeps the zoom', async () => {
    store.loadImage(fakeImage(400, 300)); // fits → scale stays 1
    await settle();
    ctx().ops.length = 0;
    wrapSize = { w: 900, h: 700 };
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(isBlank(ctx().ops)).toBe(false);
  });

  it('is not left blank after a window resize that changes the zoom', async () => {
    store.loadImage(fakeImage(4000, 3000));
    await settle();
    ctx().ops.length = 0;
    wrapSize = { w: 600, h: 500 };
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(isBlank(ctx().ops)).toBe(false);
    expect(ctx().ops).toContain('drawImage');
  });

  it('never computes a negative zoom when the container is tiny', async () => {
    wrapSize = { w: 10, h: 10 };
    store.loadImage(fakeImage(400, 300));
    await settle();
    expect(store.scale).toBeGreaterThan(0);
  });

  it('clicking the drop zone opens the file picker', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await wrapper.find('.drop-zone').trigger('click');
    await nextTick();
    expect(click).toHaveBeenCalled();
  });

  it('dropping a non-image shows an error without asking to discard regions', async () => {
    store.loadImage(fakeImage(400, 300));
    store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 8 });
    await settle();
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    await wrapper.find('.canvas-wrap').trigger('drop', { dataTransfer: { files: [file] } });
    await nextTick();
    expect(useConfirm().open.value).toBe(false);
    expect(useToast().message.value).toBe(i18n.global.t('toast.notImage'));
  });

  it('pasting an image loads it (after confirming the replacement)', async () => {
    store.loadImage(fakeImage(400, 300));
    await settle();
    const file = new File(['x'], 'p.png', { type: 'image/png' });
    const e = new Event('paste') as ClipboardEvent;
    Object.defineProperty(e, 'clipboardData', {
      value: {
        items: [
          { type: 'text/plain', getAsFile: () => null },
          { type: 'image/png', getAsFile: () => file },
        ],
      },
    });
    window.dispatchEvent(e);
    await nextTick();
    expect(useConfirm().open.value).toBe(true);
    expect(useConfirm().options.value?.danger).toBeFalsy(); // no regions → plain "replace?" prompt
  });

  it('highlights the drop zone while dragging over it', async () => {
    const zone = wrapper.find('.drop-zone');
    await wrapper.find('.canvas-wrap').trigger('dragover');
    expect(zone.classes()).toContain('dragover');
    await wrapper.find('.canvas-wrap').trigger('dragleave');
    expect(zone.classes()).not.toContain('dragover');
  });
});
