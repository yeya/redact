<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore, MIN_STRENGTH, MAX_STRENGTH, REVERSIBLE_EFFECTS } from '../stores/editor';
import type { Effect } from '../types';

const store = useEditorStore();

const effectValue = computed<Effect>({
  get: () => store.controlEffect,
  set: (v) => store.setEffect(v),
});

const strengthValue = computed<number>({
  get: () => store.controlStrength,
  set: (v) => store.setStrength(v),
});

const reversible = computed(() => REVERSIBLE_EFFECTS.includes(store.controlEffect));
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
    <span
      v-if="reversible"
      class="weak-warning"
      role="img"
      :title="$t('weakEffectWarning')"
      :aria-label="$t('weakEffectWarning')"
      >⚠</span
    >
  </label>
  <label class="field">
    {{ $t('strength') }}
    <!-- `input` updates live (coalesced into one undo step); `change` fires on
         release and closes that step, so each slider drag is one undo. -->
    <input
      v-model.number="strengthValue"
      type="range"
      :min="MIN_STRENGTH"
      :max="MAX_STRENGTH"
      @change="store.commitEdit()"
    />
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
.weak-warning {
  color: var(--warning);
  font-size: 13px;
  cursor: help;
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
