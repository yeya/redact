<script setup lang="ts">
import { computed } from 'vue';
import i18n, { setLocale, currentLocale, type Locale } from '../i18n';

const current = computed<Locale>(() => currentLocale());

function toggle() {
  setLocale(current.value === 'he' ? 'en' : 'he');
}
</script>

<template>
  <button
    class="lang-toggle sm"
    :title="i18n.global.t('lang.' + (current === 'he' ? 'en' : 'he'))"
    @click="toggle"
  >
    {{ current === 'he' ? 'EN' : 'עב' }}
  </button>
</template>

<style scoped>
.lang-toggle {
  min-width: 34px;
  text-align: center;
}
</style>
