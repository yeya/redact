import { describe, it, expect, beforeEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import EffectControls from '../src/components/EffectControls.vue';
import LanguageToggle from '../src/components/LanguageToggle.vue';
import { useEditorStore, MIN_STRENGTH, MAX_STRENGTH } from '../src/stores/editor';
import i18n, { setLocale } from '../src/i18n';

describe('EffectControls', () => {
  let store: ReturnType<typeof useEditorStore>;
  let wrapper: VueWrapper;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useEditorStore();
    store.addRegion({ x: 0, y: 0, w: 10, h: 10, effect: 'blur', strength: 12 });
    wrapper = mount(EffectControls, { global: { plugins: [pinia, i18n] } });
  });

  it('uses the store limits for the slider', () => {
    const slider = wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe(String(MIN_STRENGTH));
    expect(slider.attributes('max')).toBe(String(MAX_STRENGTH));
  });

  it('one slider drag (many input events, then change) is one undo step', async () => {
    const slider = wrapper.find('input[type="range"]');
    // a real slider fires `input` while dragging and `change` once on release
    // (VTU's setValue fires both, so drive the events by hand)
    const drag = async (v: number) => {
      (slider.element as HTMLInputElement).value = String(v);
      await slider.trigger('input');
    };
    const before = store.history.length;
    for (const v of [14, 18, 22, 30]) await drag(v);
    await slider.trigger('change');
    expect(store.regions[0].strength).toBe(30);
    expect(store.history).toHaveLength(before + 1);

    for (const v of [20, 16]) await drag(v);
    await slider.trigger('change');
    expect(store.history).toHaveLength(before + 2);
    store.undo();
    expect(store.regions[0].strength).toBe(30);
  });

  it('changing the effect applies it to the selection', async () => {
    await wrapper.find('select').setValue('black');
    expect(store.regions[0].effect).toBe('black');
  });

  it('warns that blur/pixelate/frosted are reversible, but not for solid fills', async () => {
    expect(wrapper.find('.weak-warning').exists()).toBe(true);
    await wrapper.find('select').setValue('pixelate');
    expect(wrapper.find('.weak-warning').exists()).toBe(true);
    await wrapper.find('select').setValue('white');
    expect(wrapper.find('.weak-warning').exists()).toBe(false);
  });
});

describe('LanguageToggle', () => {
  it('switches the locale and offers the other language', async () => {
    setLocale('he');
    const w = mount(LanguageToggle, { global: { plugins: [i18n] } });
    expect(w.text()).toBe('EN');
    expect(w.attributes('title')).toBe('English');
    await w.trigger('click');
    expect(i18n.global.locale.value).toBe('en');
    expect(w.text()).toBe('עב');
    expect(w.attributes('title')).toBe('עברית');
    setLocale('he');
  });
});
