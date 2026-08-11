<script setup>
import { computed } from 'vue'
import { useChannelsStore } from '../stores/channels'

const props = defineProps({
  groupName: { type: String, required: true },
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
})

const channelsStore = useChannelsStore()

// 窗口化页码（最多显示 5 个，当前页居中）
const visiblePages = computed(() => {
  const maxVisible = 5
  let startPage = Math.max(1, props.page - Math.floor(maxVisible / 2))
  let endPage = Math.min(props.totalPages, startPage + maxVisible - 1)
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }
  const pages = []
  for (let i = startPage; i <= endPage; i++) pages.push(i)
  return pages
})

function go(page) {
  if (page < 1 || page > props.totalPages) return
  channelsStore.goToGroupPage(props.groupName, page)
}
</script>

<template>
  <div class="group-pagination">
    <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="go(page - 1)">‹</button>
    <span v-for="i in visiblePages" :key="i" class="page-btn"
      :class="{ active: i === page }" @click="go(i)">{{ i }}</span>
    <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="go(page + 1)">›</button>
  </div>
</template>
