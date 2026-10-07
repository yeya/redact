<script setup lang="ts">
import { useEditorStore } from '../stores/editor';

const store = useEditorStore();
</script>

<template>
  <div v-if="store.selectedCount > 1" class="multi-hint">
    <b>{{ store.selectedCount }}</b>
    <span>{{ $t('multiHint') }}</span>
  </div>
</template>

<style scoped>
.multi-hint {
  font-size: 11px;
  color: var(--text-dim);
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.multi-hint b {
  color: var(--accent);
}
</style>
