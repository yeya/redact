import { useEditorStore } from '../stores/editor';
import { useToast } from './useToast';
import { useConfirm } from './useConfirm';
import i18n from '../i18n';

/** One hidden file input shared by every "open image" entry point. */
let fileInput: HTMLInputElement | null = null;

/**
 * Image acquisition: file picker, drag-and-drop, and clipboard paste, all
 * funnelled through `requestFile` (validate → confirm-before-discard → load).
 * Matches the original's two-tier prompt: replacing an image that already has
 * regions asks to discard; replacing an image with no regions still asks.
 * The prompt is a themed modal (via useConfirm), not the browser's alert.
 */
export function useImageLoader() {
  const store = useEditorStore();
  const toast = useToast();
  const { confirm } = useConfirm();
  const t = i18n.global.t;

  function isImage(file: File | undefined | null): file is File {
    return !!file && file.type.startsWith('image/');
  }

  function loadFile(file: File | undefined | null): void {
    if (!isImage(file)) {
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

  /** Resolves true when it is OK to replace the current image (if any). */
  async function confirmReplace(): Promise<boolean> {
    if (store.hasImage && store.hasRegions) {
      return confirm({
        title: t('confirm.discardTitle'),
        message: t('confirm.discardRegions'),
        confirmLabel: t('confirm.discard'),
        danger: true,
      });
    }
    if (store.hasImage) {
      return confirm({
        title: t('confirm.replaceTitle'),
        message: t('confirm.replaceImage'),
        confirmLabel: t('confirm.confirm'),
      });
    }
    return true;
  }

  /** Load a dropped/pasted file. Non-images are rejected before any prompt. */
  async function requestFile(file: File | undefined | null): Promise<void> {
    if (!isImage(file)) {
      toast.show(t('toast.notImage'), false);
      return;
    }
    if (await confirmReplace()) loadFile(file);
  }

  function getFileInput(): HTMLInputElement {
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.hidden = true;
      fileInput.addEventListener('change', () => {
        const input = fileInput!;
        loadFile(input.files?.[0]);
        input.value = '';
      });
      document.body.appendChild(fileInput);
    }
    return fileInput;
  }

  /**
   * Confirm (if replacing), then open the system file picker. With no image
   * loaded the picker opens synchronously, inside the click that asked for it
   * (browsers only open pickers during a user gesture); after a confirm it
   * opens from the dialog button's click, which is a fresh gesture.
   */
  async function openFilePicker(): Promise<void> {
    if (!store.hasImage) {
      getFileInput().click();
      return;
    }
    if (await confirmReplace()) getFileInput().click();
  }

  return { loadFile, requestFile, openFilePicker };
}
