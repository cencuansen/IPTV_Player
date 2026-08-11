<script setup>
import { ref, watch, nextTick } from 'vue'
import { useSourcesStore } from '../stores/sources'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open'])

const sourcesStore = useSourcesStore()
const url = ref('')
const inputEl = ref(null)

watch(() => props.open, (open) => {
  if (open) {
    url.value = ''
    nextTick(() => inputEl.value && inputEl.value.focus())
  }
})

function close() {
  emit('update:open', false)
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) close()
}

function submit() {
  const value = url.value.trim()
  if (!value) {
    alert('请输入播放列表地址')
    return
  }
  sourcesStore.importFromUrl(value)
  close()
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click="onOverlayClick">
    <div class="modal">
      <div class="modal-header">
        <h3>从 URL 导入播放列表</h3>
        <button class="btn-close" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <label class="form-label">播放列表地址 (M3U / M3U8)</label>
        <input ref="inputEl" type="text" class="form-input" placeholder="https://***.m3u8"
          v-model="url" @keydown.enter="submit" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">取消</button>
        <button class="btn btn-primary" @click="submit">导入</button>
      </div>
    </div>
  </div>
</template>
