import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Images never leave the browser. The production build pins that down with a
 * Content-Security-Policy that forbids any network access beyond loading the
 * app's own files (`connect-src 'none'`), so no script — ours or a
 * compromised dependency's — can upload what the user opens. Build-only: the
 * dev server needs a websocket for HMR.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'redact:csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [vue(), contentSecurityPolicy()],
});
