import { ref } from 'vue';

interface ConfirmOptions {
  /** Heading line, e.g. "Load a new image?". */
  title: string;
  /** Explanatory body, e.g. "Loading a new image will discard all current regions." */
  message: string;
  /** Confirm button label (defaults to the locale's "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (defaults to the locale's "Cancel"). */
  cancelLabel?: string;
  /** Use the danger styling on the confirm button (e.g. discard). */
  danger?: boolean;
}

// Module-level singleton state — any caller's `confirm()` drives one modal.
const open = ref(false);
const options = ref<ConfirmOptions | null>(null);
let resolver: ((value: boolean) => void) | null = null;

/**
 * Programmatic confirm dialog. Returns a Promise<boolean> — `true` when the
 * user confirms, `false` (or rejects) on cancel / Escape / backdrop. Replaces
 * the browser's `window.confirm` with a themed modal.
 */
export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    // If a dialog is already open, resolve the previous one as cancelled so we
    // never leave a Promise hanging.
    if (resolver) resolver(false);
    options.value = opts;
    open.value = true;
    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  }

  function resolve(value: boolean): void {
    if (!resolver) return;
    const r = resolver;
    resolver = null;
    options.value = null;
    open.value = false;
    r(value);
  }

  function cancel(): void {
    resolve(false);
  }
  function accept(): void {
    resolve(true);
  }

  return { open, options, confirm, cancel, accept };
}
