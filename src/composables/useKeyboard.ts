import { onMounted, onUnmounted } from 'vue';
import type { useEditorStore } from '../stores/editor';

type Store = ReturnType<typeof useEditorStore>;

/**
 * Global keyboard shortcuts, mirroring the original. Ignored when focus is in
 * an INPUT/SELECT (so the strength slider / effect dropdown keep working).
 *   Ctrl/Cmd+Z       undo
 *   Ctrl/Cmd+Y       redo
 *   Ctrl/Cmd+Shift+Z redo
 *   Delete / Backspace  delete selected
 *   Escape           clear selection
 *   Ctrl/Cmd+A       select all
 */
export function useKeyboard(store: Store): void {
  function isTyping(): boolean {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  function onKey(e: KeyboardEvent): void {
    if (isTyping()) return;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      store.undo();
      return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
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
    if (mod && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      store.selectAll();
      return;
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey));
  onUnmounted(() => window.removeEventListener('keydown', onKey));
}
