import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import RegionSidebar from '../src/components/RegionSidebar.vue';
import AppToast from '../src/components/AppToast.vue';
import { useEditorStore } from '../src/stores/editor';
import { useToast } from '../src/composables/useToast';
import i18n from '../src/i18n';

describe('RegionSidebar', () => {
  let store: ReturnType<typeof useEditorStore>;
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useEditorStore();
    wrapper = mount(RegionSidebar, { global: { plugins: [pinia, i18n] } });
  });

  const button = (label: string) => wrapper.findAll('.sidebar-actions button').find((b) => b.text() === label)!;

  it('shows the empty state and disables the actions with no regions', () => {
    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(button(i18n.global.t('selectAll')).attributes('disabled')).toBeDefined();
    expect(button(i18n.global.t('delete')).attributes('disabled')).toBeDefined();
  });

  it('lists regions, selects from the list, and deletes', async () => {
    store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 12 });
    store.addRegion({ x: 20, y: 20, w: 10, h: 10, effect: 'black', strength: 12 });
    await wrapper.vm.$nextTick();
    const items = wrapper.findAll('.rect-item');
    expect(items).toHaveLength(2);
    expect(wrapper.find('.count-badge').text()).toBe('2');
    expect(items[1].classes()).toContain('selected');

    await items[0].trigger('click', { shiftKey: true });
    expect(store.selectedIds).toEqual([2, 1]);

    await items[0].find('.rect-del').trigger('click');
    expect(store.regions.map((r) => r.id)).toEqual([2]);
    expect(store.selectedIds).toEqual([2]); // delete button doesn't change selection

    await button(i18n.global.t('selectAll')).trigger('click');
    await button(i18n.global.t('delete')).trigger('click');
    expect(store.regions).toHaveLength(0);
  });
});

describe('AppToast / useToast', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a message, then hides it after 2.5s', async () => {
    vi.useFakeTimers();
    const w = mount(AppToast);
    useToast().show('Hello', false);
    await w.vm.$nextTick();
    expect(w.text()).toBe('Hello');
    expect(w.classes()).toContain('show');
    expect(w.classes()).not.toContain('ok');
    vi.advanceTimersByTime(2499);
    expect(useToast().visible.value).toBe(true);
    vi.advanceTimersByTime(1);
    await w.vm.$nextTick();
    expect(w.classes()).not.toContain('show');
  });

  it('a new message restarts the timer', () => {
    vi.useFakeTimers();
    const toast = useToast();
    toast.show('one');
    vi.advanceTimersByTime(2000);
    toast.show('two');
    vi.advanceTimersByTime(2000);
    expect(toast.visible.value).toBe(true);
    expect(toast.message.value).toBe('two');
    vi.advanceTimersByTime(500);
    expect(toast.visible.value).toBe(false);
  });
});
