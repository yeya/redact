<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../stores/editor';
import type { Effect } from '../types';

const store = useEditorStore();

const effectValue = computed<string>({
  get: () => store.controlEffect,
  set: (v) => store.setEffect(v as Effect),
});

const strengthValue = computed<number>({
  get: () => store.controlStrength,
  set: (v) => store.setStrength(v),
});
</script>

<template>
  <label class="field">
    {{ $t('effect') }}
    <select v-model="effectValue">
      <option value="blur">{{ $t('effects.blur') }}</option>
      <option value="pixelate">{{ $t('effects.pixelate') }}</option>
      <option value="black">{{ $t('effects.black') }}</option>
      <option value="white">{{ $t('effects.white') }}</option>
      <option value="frosted">{{ $t('effects.frosted') }}</option>
    </select>
  </label>
  <label class="field">
    {{ $t('strength') }}
    <input type="range" min="2" max="40" v-model.number="strengthValue" />
    <span class="strength-num">{{ store.controlStrength }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
}
select {
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 4px 8px;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}
select:focus {
  border-color: var(--accent);
}
input[type='range'] {
  width: 80px;
  accent-color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
}
.strength-num {
  font-family: var(--mono);
  font-size: 11px;
  width: 22px;
  text-align: center;
}
</style>
