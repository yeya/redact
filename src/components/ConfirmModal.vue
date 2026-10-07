<script setup lang="ts">
import { watch, onMounted, onUnmounted, nextTick, ref } from 'vue';
import { useConfirm } from '../composables/useConfirm';
import i18n from '../i18n';

const { open, options, cancel, accept } = useConfirm();
const t = i18n.global.t;

const confirmBtn = ref<HTMLButtonElement | null>(null);

// Auto-focus the confirm button when the modal opens; close on Escape.
watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    confirmBtn.value?.focus();
  }
});

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
  } else if (e.key === 'Enter') {
    // A focused button handles Enter natively (Cancel must cancel); only
    // treat Enter as "confirm" when focus is elsewhere.
    if (document.activeElement instanceof HTMLButtonElement) return;
    e.preventDefault();
    accept();
  }
}

function onBackdrop(e: MouseEvent) {
  // Only cancel if the click was on the backdrop itself, not inside the card.
  if (e.target === e.currentTarget) cancel();
}

// Attach the keydown listener for the modal's lifetime.
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Transition name="modal">
    <div v-if="open && options" class="backdrop" @click="onBackdrop">
      <div class="card" role="alertdialog" aria-modal="true">
        <h3 v-if="options.title" class="title">{{ options.title }}</h3>
        <p class="message">{{ options.message }}</p>
        <div class="actions">
          <button class="cancel" @click="cancel">
            {{ options.cancelLabel ?? t('confirm.cancel') }}
          </button>
          <button ref="confirmBtn" :class="options.danger ? 'danger' : 'primary'" @click="accept">
            {{ options.confirmLabel ?? (options.danger ? t('confirm.discard') : t('confirm.confirm')) }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 14, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px 24px;
  max-width: 380px;
  width: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.5),
    0 2px 0 rgba(255, 255, 255, 0.02) inset;
}
.title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.message {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-dim);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}
.actions .cancel {
  min-width: 72px;
  justify-content: center;
}
.actions button.primary,
.actions button.danger {
  min-width: 72px;
  justify-content: center;
}
.actions button.danger {
  background: rgba(249, 91, 91, 0.12);
  border-color: rgba(249, 91, 91, 0.4);
}
.actions button.danger:hover {
  background: rgba(249, 91, 91, 0.2);
  border-color: var(--danger);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-active .card,
.modal-leave-active .card {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .card,
.modal-leave-to .card {
  transform: translateY(8px) scale(0.98);
}
</style>
