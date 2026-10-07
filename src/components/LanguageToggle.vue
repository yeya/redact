<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { toggleLocale } from '../i18n';

const { t, locale } = useI18n();
</script>

<template>
  <button class="lang-toggle sm" :title="t(locale === 'he' ? 'lang.en' : 'lang.he')" @click="toggleLocale()">
    {{ locale === 'he' ? 'EN' : 'עב' }}
  </button>
</template>

<style scoped>
.lang-toggle {
  min-width: 34px;
  text-align: center;
}
</style>
