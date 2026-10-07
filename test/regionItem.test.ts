import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import RegionItem from '../src/components/RegionItem.vue';
import i18n, { setLocale } from '../src/i18n';
import type { Region } from '../src/types';

const region: Region = { id: 3, x: 10.4, y: 20.6, w: 30, h: 40, effect: 'pixelate', strength: 12 };

describe('RegionItem', () => {
  afterEach(() => setLocale('he'));

  it('shows the effect, strength and coordinates in Hebrew', () => {
    setLocale('he');
    const w = mount(RegionItem, { props: { region, index: 0, selected: false }, global: { plugins: [i18n] } });
    const text = w.text();
    expect(text).toContain('אזור 1');
    expect(text).toContain('פיקסלים');
    expect(text).toContain('עוצמה 12');
    expect(text).toContain('10, 21 · 30×40 פיקסל');
    expect(text).not.toContain('pixelate');
    expect(text).not.toContain('str');
  });

  it('follows a locale switch', async () => {
    setLocale('he');
    const w = mount(RegionItem, { props: { region, index: 1, selected: true }, global: { plugins: [i18n] } });
    setLocale('en');
    await nextTick();
    expect(w.text()).toContain('Region 2');
    expect(w.text()).toContain('Pixelate');
    expect(w.text()).toContain('10, 21 · 30×40px');
  });

  it('emits select (with shift) and delete', async () => {
    const w = mount(RegionItem, { props: { region, index: 0, selected: false }, global: { plugins: [i18n] } });
    await w.trigger('click', { shiftKey: true });
    await w.find('.rect-del').trigger('click');
    expect(w.emitted('select')).toEqual([[3, true]]);
    expect(w.emitted('delete')).toEqual([[3]]);
  });
});
