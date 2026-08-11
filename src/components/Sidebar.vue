<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useChannelsStore } from '../stores/channels'
import GroupList from './GroupList.vue'

const channelsStore = useChannelsStore()

// 搜索框本地值：立即反映输入；外部（导入后清空）通过 watch 同步回本地
const keyword = ref(channelsStore.searchKeyword)
let searchTimer = null

watch(() => channelsStore.searchKeyword, (v) => {
  keyword.value = v
})

function onInput(e) {
  keyword.value = e.target.value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    channelsStore.setSearchKeyword(e.target.value.trim())
  }, 300)
}

onUnmounted(() => clearTimeout(searchTimer))
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-header-left">
        <span class="sidebar-title">频道</span>
        <span id="statusText"></span>
      </div>
      <span class="channel-count">{{ channelsStore.channels.length }} 个频道</span>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="🔍 搜索频道..."
        :value="keyword" @input="onInput" />
    </div>
    <div class="group-list">
      <GroupList />
    </div>
  </aside>
</template>
