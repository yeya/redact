# Redact

**Live:** https://yeya.github.io/redact/

Manual image redaction in the browser: open an image, draw rectangles over what
should be hidden, pick an effect per region (blur, pixelate, solid black/white,
frosted glass), and export at full resolution as PNG, JPEG or WebP — or copy to
the clipboard. Hebrew (default, RTL) and English UI.

## Privacy

Everything happens locally; images are never uploaded. The production build
ships a Content-Security-Policy with `connect-src 'none'`, so the page cannot
make network requests even if a dependency tried to. Exports are re-encoded
from a canvas, which drops EXIF metadata (GPS location, camera, timestamps).

**Choose the effect to match the risk.** Solid black/white removes the pixels.
Blur, pixelate and frosted glass only obscure them; with weak settings, text
under them can sometimes be recovered. The toolbar shows a warning for these
effects, and strength has a floor of 6px to avoid trivially reversible
results. For passwords, IDs, faces in sensitive contexts, etc., use a solid
fill.

## Usage

| Action                         | How                                                                     |
| ------------------------------ | ----------------------------------------------------------------------- |
| Open an image                  | **Open image**, click the drop zone, drag & drop, or paste (Ctrl/Cmd+V) |
| Add a region                   | Drag on the image                                                       |
| Select / multi-select          | Click a region (canvas or sidebar); Shift+click to toggle               |
| Move / resize                  | Drag a region's body / one of its 8 handles                             |
| Change effect or strength      | Toolbar controls (apply to all selected regions)                        |
| Undo / redo                    | Ctrl/Cmd+Z / Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z                             |
| Select all / deselect / delete | Ctrl/Cmd+A / Escape / Delete or Backspace                               |

Shortcuts match physical keys, so they work on any keyboard layout.

## Development

Requires Node `^22.12 || ^24 || >=26`.

```sh
npm install
npm run dev            # dev server
npm run build          # typecheck + production build into dist/
npm run preview        # serve the production build
npm run check          # typecheck, lint, format check, unit tests (what CI runs)
npm test               # unit/component tests (Vitest + jsdom)
npm run test:coverage  # …with a coverage report in coverage/
npm run test:e2e       # Playwright against the production build
npm run format         # apply Prettier
```

First E2E run: `npx playwright install --only-shell chromium`.

## Deployment

Every push to `main` that passes CI (typecheck, lint, format, unit and E2E
tests) is built and deployed to GitHub Pages by `.github/workflows/ci.yml`.
The build uses relative asset paths (`base: './'`), so it works under the
`/redact/` subpath without configuration.

## Layout

```
src/
  stores/editor.ts      all editor state + actions (regions, selection, undo/redo, drags)
  lib/effects.ts        pixel effects shared by the on-screen preview and the export
  lib/export.ts         full-resolution render, download, clipboard
  lib/geometry.ts       hit-testing, resize/clamp math
  composables/          canvas mouse interaction, keyboard, image loading, toast, confirm dialog
  components/           UI (TheCanvas renders the preview)
  i18n/                 vue-i18n setup + en/he messages (he is type-checked against en)
test/                   Vitest unit + component tests; helpers/canvas.ts fakes a 2D canvas
e2e/                    Playwright end-to-end tests
```

All region geometry is stored in image pixels. The preview canvas is scaled to
fit (never upscaled) and rendered at the device pixel ratio. Effects are
computed once into a cached layer and only recomputed when a region's
geometry or effect changes.
