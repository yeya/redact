import { describe, it, expect, afterEach } from 'vitest';
import en from '../src/i18n/locales/en';
import he from '../src/i18n/locales/he';
import i18n, { setLocale, toggleLocale, isRTL, STORAGE_KEY } from '../src/i18n';

/** Flatten nested message objects to dotted keys. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Look up a dotted key in a nested message object. */
function lookup(obj: object, key: string): string {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
}

/** `{name}` placeholders used by a message. */
function params(msg: string): string[] {
  return [...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('i18n', () => {
  afterEach(() => setLocale('he'));

  it('en and he define exactly the same keys', () => {
    expect(keys(he).sort()).toEqual(keys(en).sort());
  });

  it('every translation uses the same placeholders as English', () => {
    for (const k of keys(en)) expect(params(lookup(he, k)), k).toEqual(params(lookup(en, k)));
  });

  it('no message is empty', () => {
    for (const k of keys(en)) {
      expect(lookup(en, k).trim(), `en.${k}`).not.toBe('');
      expect(lookup(he, k).trim(), `he.${k}`).not.toBe('');
    }
  });

  it('setLocale switches messages, lang/dir, and persists the choice', () => {
    setLocale('en');
    expect(i18n.global.t('undo')).toBe('Undo');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');

    setLocale('he');
    expect(i18n.global.t('undo')).toBe('בטל');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('he');
  });

  it('toggleLocale flips between he and en', () => {
    setLocale('he');
    toggleLocale();
    expect(i18n.global.locale.value).toBe('en');
    toggleLocale();
    expect(i18n.global.locale.value).toBe('he');
  });

  it('only Hebrew is right-to-left', () => {
    expect(isRTL('he')).toBe(true);
    expect(isRTL('en')).toBe(false);
  });
});
