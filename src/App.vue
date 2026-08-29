<script setup>
import { ref, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import Sidebar from './components/Sidebar.vue'
import PlayerSection from './components/PlayerSection.vue'
import UrlImportModal from './components/UrlImportModal.vue'
import HistoryModal from './components/HistoryModal.vue'
import SourceDetailModal from './components/SourceDetailModal.vue'
import { useSourcesStore } from './stores/sources'

const sourcesStore = useSourcesStore()

// 弹窗开关状态（组件局部，不占 store）
const urlModalOpen = ref(false)
const historyModalOpen = ref(false)
const detailModal = ref({ open: false, sourceId: null })

function openDetail(sourceId) {
  detailModal.value = { open: true, sourceId }
}

onMounted(() => {
  // 初始化：优先恢复上次应用的导入记录；无匹配记录（如首次运行）再显示最新导入的频道
  if (!sourcesStore.restoreCurrentSource()) {
    sourcesStore.showLatestSource()
  }
})
</script>

<template>
  <div class="app">
    <AppHeader
      @import-url="urlModalOpen = true"
      @open-history="historyModalOpen = true" />

    <div class="main-content">
      <Sidebar />
      <PlayerSection />
    </div>

    <UrlImportModal v-model:open="urlModalOpen" />
    <HistoryModal v-model:open="historyModalOpen" @open-detail="openDetail" />
    <SourceDetailModal v-model:open="detailModal.open" :source-id="detailModal.sourceId" />
  </div>
</template>
