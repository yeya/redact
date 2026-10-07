import { onMounted, onUnmounted } from 'vue';
import type { useEditorStore } from '../stores/editor';
import { useConfirm } from './useConfirm';

type Store = ReturnType<typeof useEditorStore>;

/**
 * Global keyboard shortcuts, mirroring the original. Ignored when focus is in
 * an INPUT/SELECT (so the strength slider / effect dropdown keep working) and
 * while the confirm dialog is open (it owns the keyboard then).
 *   Ctrl/Cmd+Z       undo
 *   Ctrl/Cmd+Y       redo
 *   Ctrl/Cmd+Shift+Z redo
 *   Delete / Backspace  delete selected
 *   Escape           clear selection
 *   Ctrl/Cmd+A       select all
 *
 * Letter shortcuts match the physical key (`e.code`), so they keep working on
 * non-Latin layouts such as Hebrew, where Ctrl+Z reports `e.key === 'ז'`.
 */
export function useKeyboard(store: Store): void {
  const { open: dialogOpen } = useConfirm();

  function isTyping(): boolean {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  function onKey(e: KeyboardEvent): void {
    if (dialogOpen.value || isTyping()) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      store.undo();
      return;
    }
    if (mod && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
      e.preventDefault();
      store.redo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedIds.length) {
      e.preventDefault();
      store.deleteSelected();
      return;
    }
    if (e.key === 'Escape') {
      store.clearSelection();
      return;
    }
    if (mod && e.code === 'KeyA') {
      e.preventDefault();
      store.selectAll();
      return;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));
}
