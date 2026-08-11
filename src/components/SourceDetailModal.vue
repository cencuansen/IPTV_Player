<script setup>
import { ref, computed, watch } from 'vue'
import { useSourcesStore } from '../stores/sources'
import { fetchSourceRaw } from '../utils/http'
import { copyText } from '../utils/clipboard'
import { decodeUrlForDisplay } from '../utils/storage'

const props = defineProps({
  open: Boolean,
  sourceId: { type: String, default: null },
})
const emit = defineEmits(['update:open'])

const sourcesStore = useSourcesStore()

// 当前详情弹窗对应的导入记录 id（防止异步结果串台）与原始路径/地址（供"复制路径"使用）
let detailSourceId = null
const detailRawSource = ref('')
const content = ref('')
const status = ref({ text: '', kind: '' })

// 复制按钮反馈：按按钮 key（'source' | 'content'）独立记录，避免相互影响
const copyFeedback = ref({}) // { [key]: '' | 'copied' | 'failed' }
const copyTimers = {}

const detailSourceDisplay = computed(() => decodeUrlForDisplay(detailRawSource.value))

// 复制后按钮短暂显示"已复制 ✓"；失败显示"复制失败"
function copyBtnText(key, base) {
  const state = copyFeedback.value[key]
  if (!state) return base
  return state === 'copied' ? '已复制 ✓' : '复制失败'
}

// ===== M3U 内容分页 =====
// 按频道条目（#EXTINF 及其后续行）分页，避免单个频道被拆到两页；无 #EXTINF 时退化为按行分页
const CONTENT_CHANNELS_PER_PAGE = 50
const CONTENT_LINES_PER_PAGE = 200
const contentPage = ref(1)
const contentPages = computed(() => {
  const text = content.value
  if (!text) return []
  const lines = text.split('\n')
  if (lines.some(l => l.startsWith('#EXTINF:'))) {
    const pages = []
    let cur = []
    let ch = 0
    const flush = () => { if (cur.length) { pages.push(cur); cur = [] } }
    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        if (ch >= CONTENT_CHANNELS_PER_PAGE) { flush(); ch = 0 }
        ch++
      }
      cur.push(line)
    }
    flush()
    return pages.map(p => p.join('\n'))
  }
  const pages = []
  for (let i = 0; i < lines.length; i += CONTENT_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + CONTENT_LINES_PER_PAGE).join('\n'))
  }
  return pages
})
const totalContentPages = computed(() => contentPages.value.length)
const currentContentPage = computed(() => contentPages.value[contentPage.value - 1] ?? '')

function contentGoPage(p) {
  const total = totalContentPages.value
  if (!total) return
  if (p < 1) p = 1
  if (p > total) p = total
  contentPage.value = p
}

watch(() => props.open, (open) => {
  if (!open) return
  const src = sourcesStore.sources.find(s => s.id === props.sourceId)
  if (!src) return
  detailSourceId = src.id
  detailRawSource.value = src.source
  content.value = ''
  contentPage.value = 1

  if (src.content) {
    content.value = src.content
    setStatus('')
  } else {
    // 文件内容本地缺失时按需获取
    setStatus('正在加载文件内容...', 'loading')
    loadSourceContent(src)
  }
})

// 内容变化（含异步加载完成）后回到第一页
watch(content, () => { contentPage.value = 1 })

// 弹窗内状态提示：text 为空则隐藏；kind ∈ loading | error
function setStatus(text, kind) {
  status.value = { text, kind }
}

async function loadSourceContent(src) {
  try {
    const raw = await fetchSourceRaw(src)
    src.content = raw
    if (detailSourceId !== src.id) return // 期间已切换到其他记录
    content.value = raw
    setStatus('')
  } catch (err) {
    if (detailSourceId !== src.id) return
    setStatus('加载文件内容失败', 'error')
  }
}

function close() {
  emit('update:open', false)
  detailSourceId = null
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) close()
}

// 复制文本并短暂显示"已复制"反馈（按 key 独立计时）
async function copy(key, text) {
  if (!text) return
  const ok = await copyText(text)
  copyFeedback.value[key] = ok ? 'copied' : 'failed'
  clearTimeout(copyTimers[key])
  copyTimers[key] = setTimeout(() => { copyFeedback.value[key] = '' }, 1200)
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click="onOverlayClick">
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>导入详情</h3>
        <button class="btn-close" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="status.text" class="detail-status" :class="status.kind">{{ status.text }}</div>
        <div class="detail-label-row">
          <label class="form-label">M3U 路径 / 地址</label>
          <button class="btn btn-sm btn-secondary" @click="copy('source', detailRawSource)">{{ copyBtnText('source',
            '复制路径') }}</button>
        </div>
        <div class="detail-source" :title="detailSourceDisplay">{{ detailSourceDisplay }}</div>
        <div class="detail-label-row">
          <label class="form-label">M3U 文件内容</label>
          <button class="btn btn-sm btn-secondary" @click="copy('content', content)">{{ copyBtnText('content', '复制内容')
            }}</button>
        </div>
        <pre class="detail-content">{{ currentContentPage }}</pre>
        <div v-if="totalContentPages > 1" class="content-pagination">
          <button class="btn btn-sm" :disabled="contentPage <= 1" @click="contentGoPage(contentPage - 1)">‹</button>
          <span class="content-page-info">第 {{ contentPage }} / {{ totalContentPages }} 页</span>
          <button class="btn btn-sm" :disabled="contentPage >= totalContentPages"
            @click="contentGoPage(contentPage + 1)">›</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>
