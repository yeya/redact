import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TheHeader from '../src/components/TheHeader.vue';
import { useEditorStore } from '../src/stores/editor';
import { useToast } from '../src/composables/useToast';
import i18n from '../src/i18n';
import { blobControl, fakeImage, installCanvasMock } from './helpers/canvas';

const flush = () => new Promise((r) => setTimeout(r, 5));

describe('TheHeader export', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    installCanvasMock();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const pinia = createPinia();
    setActivePinia(pinia);
    useEditorStore().loadImage(fakeImage(20, 20));
    wrapper = mount(TheHeader, { global: { plugins: [pinia, i18n] } });
  });

  afterEach(() => {
    wrapper.unmount();
    vi.restoreAllMocks();
  });

  const exportButton = (label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))!;

  it('confirms a successful export', async () => {
    await exportButton('PNG').trigger('click');
    await flush();
    expect(useToast().message.value).toBe(i18n.global.t('toast.saved', { fmt: 'PNG' }));
    expect(useToast().ok.value).toBe(true);
  });

  it('reports a failed export instead of claiming it was saved', async () => {
    blobControl.next = null;
    await exportButton('PNG').trigger('click');
    await flush();
    expect(useToast().message.value).toBe(i18n.global.t('toast.exportFailed'));
    expect(useToast().ok.value).toBe(false);
  });
});
