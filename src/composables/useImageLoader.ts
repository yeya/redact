import { useEditorStore } from '../stores/editor';
import { useToast } from './useToast';
import { useConfirm } from './useConfirm';
import i18n from '../i18n';

/**
 * Image acquisition: file picker, drag-and-drop, and clipboard paste, all
 * funnelled through `confirmLoad` (confirm-before-discard) then `loadFile`.
 * Matches the original's two-tier prompt: replacing an image that already has
 * regions asks to discard; replacing an image with no regions still asks.
 * The prompt is a themed modal (via useConfirm), not the browser's alert.
 */
export function useImageLoader() {
  const store = useEditorStore();
  const toast = useToast();
  const { confirm } = useConfirm();
  const t = i18n.global.t;

  function loadFile(file: File | undefined | null): void {
    if (!file || !file.type.startsWith('image/')) {
      toast.show(t('toast.notImage'), false);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      store.loadImage(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      toast.show(t('toast.loadFailed'), false);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function confirmLoad(fn: () => void): Promise<void> {
    if (store.hasImage && store.hasRegions) {
      const ok = await confirm({
        title: t('confirm.discardTitle'),
        message: t('confirm.discardRegions'),
        confirmLabel: t('confirm.discard'),
        danger: true,
      });
      if (!ok) return;
    } else if (store.hasImage) {
      const ok = await confirm({
        title: t('confirm.replaceTitle'),
        message: t('confirm.replaceImage'),
        confirmLabel: t('confirm.confirm'),
      });
      if (!ok) return;
    }
    fn();
  }

  function openImageRequest(input: HTMLInputElement): void {
    void confirmLoad(() => input.click());
  }

  return { loadFile, confirmLoad, openImageRequest };
}
