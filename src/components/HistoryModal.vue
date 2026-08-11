<script setup>
import { watch } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { decodeUrlForDisplay, formatTime } from '../utils/storage'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open', 'open-detail'])

const sourcesStore = useSourcesStore()

// 弹窗重新打开时若仍在更新，提示进行中状态
watch(() => props.open, (open) => {
  if (open && sourcesStore.historyBusy) {
    sourcesStore.setHistoryStatus('正在更新导入记录...', 'loading')
  }
})

function close() {
  emit('update:open', false)
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) close()
}

function apply(id) {
  sourcesStore.applySource(id)
}

function update(id) {
  sourcesStore.refreshSource(id)
}

function remove(id) {
  if (confirm('确定删除该导入记录及其频道吗？')) sourcesStore.removeSource(id)
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click="onOverlayClick">
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>导入历史</h3>
        <button class="btn-close" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <!-- 导入历史操作状态提示（进行中/成功/失败） -->
        <div v-if="sourcesStore.historyStatus.text" class="history-status"
          :class="sourcesStore.historyStatus.kind">
          {{ sourcesStore.historyStatus.text }}
        </div>
        <div class="history-list">
          <div v-if="sourcesStore.sources.length === 0" class="empty-state">
            <p>暂无导入记录</p>
            <p class="empty-hint">通过 URL 或文件导入后会在这里显示</p>
          </div>
          <div v-for="src in sourcesStore.sources" :key="src.id" class="history-item"
            :class="{ current: src.id === sourcesStore.latestSource?.id }">
            <div class="history-info">
              <span class="history-badge" :class="src.type">
                {{ src.type === 'url' ? 'URL' : '文件' }}
              </span>
              <span class="history-source" :title="decodeUrlForDisplay(src.source)">
                {{ decodeUrlForDisplay(src.source) }}
              </span>
              <span class="history-meta">
                {{ (src.channels || []).length }} 项 · {{ formatTime(src.importedAt) }}
              </span>
            </div>
            <!-- 更新进行中：禁用弹窗内所有操作按钮 -->
            <div class="history-actions">
              <button class="btn btn-sm btn-primary" :disabled="sourcesStore.historyBusy"
                title="直接显示本地保存的数据；本地无数据时先获取" @click="apply(src.id)">应用</button>
              <button class="btn btn-sm btn-primary" :disabled="sourcesStore.historyBusy"
                title="重新获取数据并更新本地后应用" @click="update(src.id)">更新</button>
              <button class="btn btn-sm btn-secondary" :disabled="sourcesStore.historyBusy"
                title="查看 m3u 路径/地址与文件内容" @click="emit('open-detail', src.id)">详情</button>
              <button class="btn btn-sm btn-danger" :disabled="sourcesStore.historyBusy"
                title="删除该导入记录" @click="remove(src.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>
