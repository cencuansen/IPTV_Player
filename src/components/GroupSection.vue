<script setup>
import { ref, computed } from 'vue'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useChannelsStore } from '../stores/channels'
import { usePlayHistoryStore } from '../stores/playHistory'
import { useFavoritesStore } from '../stores/favorites'
import { buildM3U } from '../utils/m3u'
import { formatTime } from '../utils/storage'
import ChannelCard from './ChannelCard.vue'
import GroupPagination from './GroupPagination.vue'

const props = defineProps({ groupName: String })

const channelsStore = useChannelsStore()
const playHistoryStore = usePlayHistoryStore()
const favoritesStore = useFavoritesStore()

// 当前搜索条件下的频道列表
const channels = computed(() => channelsStore.getGroupChannels(props.groupName))
const totalPages = computed(() => Math.max(1, Math.ceil(channels.value.length / channelsStore.pageSize)))
// 页码越界时钳制到有效范围
const page = computed(() => {
  const p = channelsStore.groupPages[props.groupName] || 1
  return Math.min(p, totalPages.value)
})
const pageChannels = computed(() => {
  const start = (page.value - 1) * channelsStore.pageSize
  return channels.value.slice(start, start + channelsStore.pageSize)
})
const expanded = computed(() => channelsStore.expanded.has(props.groupName))
const isFixed = computed(() => props.groupName === '播放历史' || props.groupName === '已收藏')
const isFavorites = computed(() => props.groupName === '已收藏')

function onHeaderClick() {
  channelsStore.toggleGroup(props.groupName)
}

function onClearClick() {
  if (props.groupName === '播放历史') {
    if (confirm('确定清空播放历史吗？')) playHistoryStore.clear()
  } else if (props.groupName === '已收藏') {
    if (confirm('确定清空全部收藏吗？')) favoritesStore.clear()
  }
}

// ===== 已收藏：全部导出 =====
async function onExportAll() {
  const list = favoritesStore.favorites
  if (!list.length) {
    alert('暂无收藏，无法导出')
    return
  }
  const selected = await save({
    title: '导出全部收藏',
    defaultPath: `收藏-${formatTime(Date.now())}.m3u8`,
    filters: [{ name: '播放列表', extensions: ['m3u8', 'm3u', 'txt'] }],
  })
  if (!selected) return
  try {
    await writeTextFile(selected, buildM3U(list))
    alert(`已导出 ${list.length} 个频道到：\n${selected}`)
  } catch (err) {
    alert('导出失败：' + (err && err.message ? err.message : err))
  }
}

// ===== 已收藏：拖拽排序（仅当前页内；搜索时禁用） =====
const dragIndex = ref(null) // 被拖拽卡片在当前页内的索引
const dropIndex = ref(null) // 当前悬停的目标索引
const canDrag = computed(() =>
  isFavorites.value && !channelsStore.searchKeyword && favoritesStore.favorites.length > 0)

function onCardDragStart(i, e) {
  dragIndex.value = i
  e.dataTransfer.effectAllowed = 'move'
  try { e.dataTransfer.setData('text/plain', String(i)) } catch { /* 忽略 */ }
}

function onCardDragOver(i, e) {
  if (dragIndex.value === null) return
  e.preventDefault() // 允许放置
  e.dataTransfer.dropEffect = 'move'
  dropIndex.value = i
}

function onCardDrop(i, e) {
  e.preventDefault()
  const from = dragIndex.value
  if (from === null || from === i) { resetDrag(); return }
  const offset = (page.value - 1) * channelsStore.pageSize
  favoritesStore.move(offset + from, offset + i)
  resetDrag()
}

function resetDrag() {
  dragIndex.value = null
  dropIndex.value = null
}
</script>

<template>
  <div class="group-section" :class="{ expanded }">
    <div class="group-section-header" :title="groupName" @click="onHeaderClick">
      <span class="group-caret">{{ expanded ? '▾' : '▸' }}</span>
      <span class="group-name">{{ groupName }}</span>
      <span class="group-count">{{ channels.length }}</span>
      <!-- "已收藏" 提供全部导出（导出全部收藏为一个 m3u8 文件） -->
      <button v-if="isFavorites" type="button" class="export-group-btn" title="导出全部收藏为 m3u8 文件"
        @click.stop="onExportAll">
        导出
      </button>
      <!-- "播放历史" 与 "已收藏" 提供一键清空 -->
      <button v-if="isFixed" type="button" class="clear-group-btn" :title="`清空${groupName}`" @click.stop="onClearClick">
        清空
      </button>
    </div>

    <div v-if="expanded" class="group-section-body">
      <div class="group-channels">
        <ChannelCard v-for="(ch, i) in pageChannels" :key="ch.url + '_' + i" :channel="ch"
          :show-delete="groupName === '播放历史'" :draggable="canDrag" :class="{
            'drag-source': dragIndex === i,
            'drag-target': dragIndex !== null && dragIndex !== i && dropIndex === i,
          }" @dragstart="onCardDragStart(i, $event)" @dragover="onCardDragOver(i, $event)"
          @drop="onCardDrop(i, $event)" @dragend="resetDrag" />
      </div>
      <GroupPagination v-if="totalPages > 1" :group-name="groupName" :page="page" :total-pages="totalPages" />
    </div>
  </div>
</template>
