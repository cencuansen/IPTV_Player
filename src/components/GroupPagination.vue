<script setup>
import { useChannelsStore } from '../stores/channels'

const props = defineProps({
  groupName: { type: String, required: true },
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
})

const channelsStore = useChannelsStore()

function go(page) {
  const target = Number(page)
  if (!Number.isFinite(target) || target < 1 || target > props.totalPages) return
  channelsStore.goToGroupPage(props.groupName, target)
}
</script>

<template>
  <div class="group-pagination">
    <button type="button" class="btn btn-sm page-arrow" :disabled="page <= 1" title="上一页"
      @click="go(page - 1)">‹</button>
    <button type="button" class="btn btn-sm" :disabled="page <= 1" title="首页" @click="go(1)">1</button>
    <!-- 下拉框：直接选择任意页 -->
    <select class="page-select" :value="page" title="选择页码" @change="go($event.target.value)">
      <option v-for="p in totalPages" :key="p" :value="p">{{ p }}</option>
    </select>
    <button type="button" class="btn btn-sm" :disabled="page >= totalPages" title="尾页"
      @click="go(totalPages)">{{ totalPages }}</button>
    <button type="button" class="btn btn-sm page-arrow" :disabled="page >= totalPages" title="下一页"
      @click="go(page + 1)">›</button>
  </div>
</template>
