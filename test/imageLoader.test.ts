import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useEditorStore } from '../src/stores/editor';
import { useImageLoader } from '../src/composables/useImageLoader';
import { useConfirm } from '../src/composables/useConfirm';
import { useToast } from '../src/composables/useToast';
import i18n from '../src/i18n';
import { fakeImage } from './helpers/canvas';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** jsdom never decodes images; fire onload/onerror ourselves. */
class FakeImage {
  static fail = false;
  naturalWidth = 64;
  naturalHeight = 48;
  width = 64;
  height = 48;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    setTimeout(() => (FakeImage.fail ? this.onerror?.() : this.onload?.()), 0);
  }
}

describe('useImageLoader', () => {
  let store: ReturnType<typeof useEditorStore>;
  let loader: ReturnType<typeof useImageLoader>;
  const png = () => new File(['x'], 'a.png', { type: 'image/png' });

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useEditorStore();
    loader = useImageLoader();
    FakeImage.fail = false;
    vi.stubGlobal('Image', FakeImage);
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    useConfirm().cancel();
    vi.unstubAllGlobals();
  });

  it('rejects a non-image before asking to discard anything', async () => {
    store.loadImage(fakeImage(10, 10));
    store.addRegion({ x: 0, y: 0, w: 5, h: 5, effect: 'blur', strength: 8 });
    await loader.requestFile(new File(['x'], 'a.txt', { type: 'text/plain' }));
    expect(useConfirm().open.value).toBe(false);
    expect(useToast().message.value).toBe(i18n.global.t('toast.notImage'));
    expect(store.regions).toHaveLength(1);
  });

  it('loads straight away when there is no image yet', async () => {
    await loader.requestFile(png());
    await flush();
    expect(store.imageSize).toEqual({ w: 64, h: 48 });
  });

  it('asks before discarding regions, and keeps them on cancel', async () => {
    store.loadImage(fakeImage(10, 10));
    store.addRegion({ x: 0, y: 0, w: 5, h: 5, effect: 'blur', strength: 8 });
    const p = loader.requestFile(png());
    expect(useConfirm().open.value).toBe(true);
    expect(useConfirm().options.value?.danger).toBe(true);
    useConfirm().cancel();
    await p;
    await flush();
    expect(store.regions).toHaveLength(1);
    expect(store.imageSize).toEqual({ w: 10, h: 10 });
  });

  it('replaces the image after confirmation', async () => {
    store.loadImage(fakeImage(10, 10));
    const p = loader.requestFile(png());
    expect(useConfirm().open.value).toBe(true);
    useConfirm().accept();
    await p;
    await flush();
    expect(store.imageSize).toEqual({ w: 64, h: 48 });
  });

  it('shows an error toast when the image cannot be decoded', async () => {
    FakeImage.fail = true;
    await loader.requestFile(png());
    await flush();
    expect(useToast().message.value).toBe(i18n.global.t('toast.loadFailed'));
    expect(store.hasImage).toBe(false);
  });
});
