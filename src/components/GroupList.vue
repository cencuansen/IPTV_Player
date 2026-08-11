<script setup>
import { computed } from 'vue'
import { useChannelsStore } from '../stores/channels'
import GroupSection from './GroupSection.vue'

const channelsStore = useChannelsStore()

// "已收藏" 固定在最上方（最新收藏的在最前），"播放历史" 固定其后
const fixedGroups = ['已收藏', '播放历史']
const searching = computed(() => !!channelsStore.searchKeyword)

// 搜索时：无匹配的分组隐藏；有匹配的分组默认折叠，由用户点击展开/收起
function showSection(name) {
  if (!searching.value) return true
  return channelsStore.getGroupChannels(name).length > 0
}
</script>

<template>
  <div>
    <template v-for="name in fixedGroups" :key="name">
      <GroupSection v-if="showSection(name)" :group-name="name" />
    </template>

    <!-- 无频道数据 -->
    <div v-if="channelsStore.channels.length === 0" class="empty-state">
      <p>暂无频道数据</p>
      <p class="empty-hint">点击右上角「文件导入」或「URL导入」添加播放列表</p>
    </div>

    <template v-else>
      <!-- "全部频道" 固定其后 -->
      <GroupSection v-if="showSection('全部频道')" group-name="全部频道" />

      <!-- 其余分组按频道数降序 -->
      <template v-for="group in channelsStore.groups" :key="group.name">
        <GroupSection v-if="showSection(group.name)" :group-name="group.name" />
      </template>
    </template>
  </div>
</template>
