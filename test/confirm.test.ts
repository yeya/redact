import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import ConfirmModal from '../src/components/ConfirmModal.vue';
import { useConfirm } from '../src/composables/useConfirm';
import i18n from '../src/i18n';

function track(p: Promise<boolean>) {
  const state: { value: boolean | undefined } = { value: undefined };
  void p.then((v) => (state.value = v));
  return state;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ConfirmModal / useConfirm', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    wrapper = mount(ConfirmModal, { global: { plugins: [i18n] }, attachTo: document.body });
  });

  afterEach(() => {
    useConfirm().cancel();
    wrapper.unmount();
  });

  it('Enter while Cancel is focused does not confirm', async () => {
    const result = track(useConfirm().confirm({ title: 'Discard?', message: 'm', danger: true }));
    await nextTick();
    await nextTick();
    const cancelBtn = wrapper.find('button.cancel').element as HTMLButtonElement;
    cancelBtn.focus();
    cancelBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    expect(result.value).not.toBe(true);
  });

  it('Enter with no button focused confirms', async () => {
    const result = track(useConfirm().confirm({ title: 't', message: 'm' }));
    await nextTick();
    (document.activeElement as HTMLElement | null)?.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    expect(result.value).toBe(true);
  });

  it('Escape cancels', async () => {
    const result = track(useConfirm().confirm({ title: 't', message: 'm' }));
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await flush();
    expect(result.value).toBe(false);
    expect(useConfirm().open.value).toBe(false);
  });

  it('clicking the buttons resolves accordingly', async () => {
    const a = track(useConfirm().confirm({ title: 't', message: 'm' }));
    await nextTick();
    await wrapper.find('button.primary').trigger('click');
    await flush();
    expect(a.value).toBe(true);

    const b = track(useConfirm().confirm({ title: 't', message: 'm' }));
    await nextTick();
    await wrapper.find('button.cancel').trigger('click');
    await flush();
    expect(b.value).toBe(false);
  });

  it('a second confirm() resolves the first as cancelled', async () => {
    const first = track(useConfirm().confirm({ title: 'one', message: 'm' }));
    const second = track(useConfirm().confirm({ title: 'two', message: 'm' }));
    await flush();
    expect(first.value).toBe(false);
    expect(second.value).toBeUndefined();
    useConfirm().accept();
    await flush();
    expect(second.value).toBe(true);
  });
});
