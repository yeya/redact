<script setup lang="ts">
import TheHeader from './components/TheHeader.vue';
import TheCanvas from './components/TheCanvas.vue';
import RegionSidebar from './components/RegionSidebar.vue';
import AppToast from './components/AppToast.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import { useEditorStore } from './stores/editor';
import { useKeyboard } from './composables/useKeyboard';

const store = useEditorStore();
useKeyboard(store);
</script>

<template>
  <div class="app-shell">
    <TheHeader />
    <main class="app-main">
      <TheCanvas />
      <RegionSidebar />
    </main>
    <AppToast />
    <ConfirmModal />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  /* In RTL the sidebar naturally renders on the left because it follows the
     canvas in DOM order and `dir=rtl` reverses the inline axis. */
}
</style>
