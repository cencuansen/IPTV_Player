<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { decodeUrlForDisplay, formatTime } from '../utils/storage'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open', 'open-detail'])

const sourcesStore = useSourcesStore()

// 状态提示自动关闭计时器（成功/失败提示 3 秒后消失；进行中提示常驻）
let statusTimer = null

function clearStatusTimer() {
  if (statusTimer) {
    clearTimeout(statusTimer)
    statusTimer = null
  }
}

// 手动关闭状态提示
function clearStatus() {
  clearStatusTimer()
  sourcesStore.setHistoryStatus('', null)
}

watch(() => sourcesStore.historyStatus, (status) => {
  clearStatusTimer()
  if (status.text && status.kind !== 'loading') {
    statusTimer = setTimeout(() => sourcesStore.setHistoryStatus('', null), 3000)
  }
})

onBeforeUnmount(clearStatusTimer)

// 弹窗重新打开时若仍在更新，提示进行中状态
watch(() => props.open, (open) => {
  if (open && sourcesStore.historyBusy) {
    sourcesStore.setHistoryStatus('正在更新导入记录...', 'loading')
  }
})

function close() {
  clearStatus()
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

// ===== 拖拽排序（手动顺序即持久化顺序，不按时间排序） =====
const dragId = ref(null) // 被拖拽记录的 id
const dropId = ref(null) // 当前悬停的目标记录 id

function onItemDragStart(src, e) {
  if (sourcesStore.historyBusy) return
  dragId.value = src.id
  e.dataTransfer.effectAllowed = 'move'
  try { e.dataTransfer.setData('text/plain', src.id) } catch { /* 忽略 */ }
}

function onItemDragOver(src, e) {
  if (dragId.value === null || dragId.value === src.id) return
  e.preventDefault() // 允许放置
  e.dataTransfer.dropEffect = 'move'
  dropId.value = src.id
}

function onItemDrop(src, e) {
  e.preventDefault()
  if (dragId.value === null || dragId.value === src.id) { resetDrag(); return }
  const from = sourcesStore.sources.findIndex(s => s.id === dragId.value)
  const to = sourcesStore.sources.findIndex(s => s.id === src.id)
  sourcesStore.moveSource(from, to)
  resetDrag()
}

function resetDrag() {
  dragId.value = null
  dropId.value = null
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
        <div class="history-list">
          <div v-if="sourcesStore.sources.length === 0" class="empty-state">
            <p>暂无导入记录</p>
            <p class="empty-hint">通过 URL 或文件导入后会在这里显示</p>
          </div>
          <!-- 点击整条记录直接应用；拖动可调整顺序 -->
          <div v-for="src in sourcesStore.sources" :key="src.id" class="history-item"
            :class="{
              current: src.id === sourcesStore.currentSourceId,
              'drag-source': dragId === src.id,
              'drag-target': dragId !== null && dragId !== src.id && dropId === src.id,
            }" :draggable="!sourcesStore.historyBusy"
            title="点击应用该记录；拖动可调整顺序" @click="apply(src.id)"
            @dragstart="onItemDragStart(src, $event)" @dragover="onItemDragOver(src, $event)"
            @drop="onItemDrop(src, $event)" @dragend="resetDrag">
            <div class="history-info">
              <span class="history-badge" :class="src.type">
                {{ src.type === 'url' ? 'URL' : '文件' }}
              </span>
              <!-- 列表只显示由导入地址/路径派生的 id；完整地址放在悬停提示里 -->
              <span class="history-source" :title="decodeUrlForDisplay(src.source)">{{ src.id }}</span>
              <span class="history-meta">
                {{ (src.channels || []).length }} 项 · {{ formatTime(src.importedAt) }}
              </span>
            </div>
            <!-- 更新进行中：禁用弹窗内所有操作按钮（按钮点击不触发整行的"应用"） -->
            <div class="history-actions">
              <button class="btn btn-sm btn-primary" :disabled="sourcesStore.historyBusy" title="重新获取数据并更新本地（不自动应用）"
                @click.stop="update(src.id)">更新</button>
              <button class="btn btn-sm btn-primary" :disabled="sourcesStore.historyBusy" title="查看 m3u 路径/地址与文件内容"
                @click.stop="emit('open-detail', src.id)">详情</button>
              <button class="btn btn-sm btn-danger" :disabled="sourcesStore.historyBusy" title="删除该导入记录"
                @click.stop="remove(src.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <!-- 状态提示与关闭按钮同一行：左侧占位恒定，提示出现/消失不移动其他元素 -->
      <div class="modal-footer history-footer">
        <div class="history-status-slot">
          <div v-if="sourcesStore.historyStatus.text" class="history-status"
            :class="sourcesStore.historyStatus.kind" :title="sourcesStore.historyStatus.text">
            <span class="history-status-text">{{ sourcesStore.historyStatus.text }}</span>
            <button type="button" class="history-status-close" title="关闭提示" @click="clearStatus">✕</button>
          </div>
        </div>
        <button class="btn btn-secondary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>
