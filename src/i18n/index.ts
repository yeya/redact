import { createI18n } from 'vue-i18n';
import en from './locales/en';
import he from './locales/he';

export type Locale = 'en' | 'he';

export const STORAGE_KEY = 'redact-locale';
const DEFAULT_LOCALE: Locale = 'he';
const RTL_LOCALES: Locale[] = ['he'];

function detectInitial(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'he') return saved;
  } catch {
    /* localStorage unavailable (private mode / SSR) — fall back to default */
  }
  return DEFAULT_LOCALE;
}

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
}

const initial = detectInitial();

const messages = { en, he };

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initial,
  fallbackLocale: 'en',
  messages,
});

applyDocumentLocale(initial);

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  applyDocumentLocale(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore persistence failure */
  }
}

export function toggleLocale(): void {
  const current = i18n.global.locale.value as Locale;
  setLocale(current === 'he' ? 'en' : 'he');
}

export default i18n;
