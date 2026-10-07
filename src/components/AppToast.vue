<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { visible, message, ok } = useToast();
</script>

<template>
  <div class="toast" :class="{ show: visible, ok }">{{ message }}</div>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 13px;
  transition: transform 0.3s;
  pointer-events: none;
  z-index: 999;
  white-space: nowrap;
}
.toast.show {
  transform: translateX(-50%) translateY(0);
}
.toast.ok {
  border-color: var(--success);
  color: var(--success);
}
</style>
