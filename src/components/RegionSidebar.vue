<script setup lang="ts">
import { useEditorStore } from '../stores/editor';
import RegionItem from './RegionItem.vue';

const store = useEditorStore();

function onSelect(id: number, shift: boolean) {
  store.select(id, shift);
}
function onDelete(id: number) {
  store.deleteRegion(id);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="title-wrap">
        <span class="sidebar-title">{{ $t('regions') }}</span>
        <span class="count-badge">{{ store.regions.length }}</span>
      </div>
      <div class="sidebar-actions">
        <button class="sm" :disabled="!store.hasRegions" @click="store.selectAll()">
          {{ $t('selectAll') }}
        </button>
        <button class="sm danger" :disabled="!store.selectedCount" @click="store.deleteSelected()">
          {{ $t('delete') }}
        </button>
      </div>
    </div>
    <div class="rect-list">
      <template v-if="store.hasRegions">
        <RegionItem
          v-for="(r, i) in store.regions"
          :key="r.id"
          :region="r"
          :index="i"
          :selected="store.isSelected(r.id)"
          @select="onSelect"
          @delete="onDelete"
        />
      </template>
      <div v-else class="empty-state">{{ $t('emptyState') }}</div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 250px;
  flex-shrink: 0;
  background: var(--surface);
  border-inline-start: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 12px 12px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.sidebar-actions {
  display: flex;
  gap: 4px;
}
.rect-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.count-badge {
  background: var(--accent-dim);
  color: var(--accent);
  border-radius: 12px;
  padding: 1px 7px;
  font-size: 11px;
  font-family: var(--mono);
}
.empty-state {
  color: var(--text-dim);
  font-size: 12px;
  text-align: center;
  padding: 24px 8px;
  line-height: 1.6;
}
</style>
