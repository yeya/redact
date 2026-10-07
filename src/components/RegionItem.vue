<script setup lang="ts">
import { computed } from 'vue';
import type { Region } from '../types';

const props = defineProps<{ region: Region; index: number; selected: boolean }>();
const emit = defineEmits<{ select: [id: number, shift: boolean]; delete: [id: number] }>();

const meta = computed(() => `${props.region.effect} · str ${props.region.strength}`);
const coords = computed(() =>
  `${Math.round(props.region.x)},${Math.round(props.region.y)} · ${Math.round(props.region.w)}×${Math.round(props.region.h)}px`,
);
const label = computed(() => `${props.index + 1}`);
</script>

<template>
  <div
    class="rect-item"
    :class="{ selected }"
    @click="emit('select', region.id, $event.shiftKey)"
  >
    <div class="rect-item-top">
      <span class="rect-label">{{ $t('region', { n: label }) }}</span>
      <button
        class="rect-del"
        :title="$t('deleteRegion')"
        @click.stop="emit('delete', region.id)"
      >×</button>
    </div>
    <span class="rect-type">{{ meta }}</span>
    <span class="rect-coords">{{ coords }}</span>
  </div>
</template>

<style scoped>
.rect-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 10px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.rect-item:hover {
  border-color: var(--text-dim);
}
.rect-item.selected {
  border-color: var(--accent);
  background: var(--accent-dim);
}
.rect-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rect-label {
  font-weight: 600;
}
.rect-type {
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 11px;
}
.rect-coords {
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 10px;
}
.rect-del {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0 2px;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}
.rect-del:hover {
  color: var(--danger);
}
</style>
