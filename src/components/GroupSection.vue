<script setup>
import { computed } from 'vue'
import { useChannelsStore } from '../stores/channels'
import { usePlayHistoryStore } from '../stores/playHistory'
import { useFavoritesStore } from '../stores/favorites'
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
</script>

<template>
  <div class="group-section" :class="{ expanded }">
    <div class="group-section-header" :title="groupName" @click="onHeaderClick">
      <span class="group-caret">{{ expanded ? '▾' : '▸' }}</span>
      <span class="group-name">{{ groupName }}</span>
      <span class="group-count">{{ channels.length }}</span>
      <!-- "播放历史" 与 "已收藏" 提供一键清空 -->
      <button v-if="isFixed" type="button" class="clear-group-btn"
        :title="`清空${groupName}`" @click.stop="onClearClick">
        清空
      </button>
    </div>

    <div v-if="expanded" class="group-section-body">
      <div class="group-channels">
        <ChannelCard v-for="(ch, i) in pageChannels"
          :key="ch.url + '_' + i"
          :channel="ch"
          :show-delete="groupName === '播放历史'" />
      </div>
      <GroupPagination v-if="totalPages > 1"
        :group-name="groupName" :page="page" :total-pages="totalPages" />
    </div>
  </div>
</template>
