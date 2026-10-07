<script setup lang="ts">
import { useEditorStore } from '../stores/editor';
import { useImageLoader } from '../composables/useImageLoader';
import { useToast } from '../composables/useToast';
import { exportImg, copyImg, type ExportFormat } from '../lib/export';
import EffectControls from './EffectControls.vue';
import MultiSelectHint from './MultiSelectHint.vue';
import LanguageToggle from './LanguageToggle.vue';
import i18n from '../i18n';

const store = useEditorStore();
const { openFilePicker } = useImageLoader();
const toast = useToast();
const t = i18n.global.t;

async function doExport(fmt: ExportFormat) {
  if (!store.image) return;
  const ok = await exportImg(store.image, store.regions, fmt);
  toast.show(ok ? t('toast.saved', { fmt: fmt.toUpperCase() }) : t('toast.exportFailed'), ok);
}

async function doCopy() {
  if (!store.image) return;
  const ok = await copyImg(store.image, store.regions);
  toast.show(ok ? t('toast.copied') : t('toast.clipboardBlocked'), ok);
}
</script>

<template>
  <header>
    <div class="logo">Re<span>dact</span></div>
    <div class="toolbar">
      <button class="primary" @click="openFilePicker()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {{ $t('open') }}
      </button>
      <div class="sep" />
      <EffectControls />
      <MultiSelectHint />
      <div class="spacer" />
      <div class="sep" />
      <button :disabled="!store.canUndo" @click="store.undo()">↩ {{ $t('undo') }}</button>
      <button :disabled="!store.canRedo" @click="store.redo()">↪ {{ $t('redo') }}</button>
      <button class="danger" :disabled="!store.hasRegions" @click="store.clearAll()">✕ {{ $t('clearAll') }}</button>
      <div class="sep" />
      <button :disabled="!store.hasImage" @click="doExport('png')">↓ {{ $t('export.png') }}</button>
      <button :disabled="!store.hasImage" @click="doExport('jpg')">↓ {{ $t('export.jpg') }}</button>
      <button :disabled="!store.hasImage" @click="doExport('webp')">↓ {{ $t('export.webp') }}</button>
      <button :disabled="!store.hasImage" @click="doCopy()">⎘ {{ $t('export.copy') }}</button>
      <div class="sep" />
      <LanguageToggle />
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.logo {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.logo span {
  color: var(--accent);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}
.sep {
  width: 1px;
  height: 28px;
  background: var(--border);
  margin: 0 4px;
}
.spacer {
  flex: 1;
}
</style>
