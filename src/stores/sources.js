import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { parseM3U } from '../utils/m3u'
import { fetchSourceRaw } from '../utils/http'
import { makeId } from '../utils/storage'
import { useChannelsStore } from './channels'
import { usePlayerStore } from './player'

// 导入记录：sources 持久化，其余状态（historyBusy 等）不持久化
export const useSourcesStore = defineStore('sources', () => {
  // 导入记录：[{ id, type: 'url'|'file', source, importedAt, channels: [], content }]
  const sources = ref([])
  // 是否有导入记录正在更新中（更新期间禁用弹窗内所有操作按钮）
  const historyBusy = ref(false)
  // 当前正在显示其频道的记录 id（不随"最新导入"走：应用任意一条记录后高亮跟随）
  const currentSourceId = ref(null)
  // 弹窗内状态提示：text 为空则隐藏；kind ∈ loading | success | error
  const historyStatus = ref({ text: '', kind: null })

  // 最新一次导入的记录（importedAt 相同时取更靠后的，即最近插入）
  const latestSource = computed(() => {
    let latest = null
    for (const s of sources.value) {
      if (!latest || s.importedAt >= latest.importedAt) latest = s
    }
    return latest
  })

  // 将记录置为"最新"：更新时间戳并移到列表末尾
  function touchSource(src) {
    src.importedAt = Date.now()
    sources.value = sources.value.filter(s => s !== src)
    sources.value.push(src)
  }

  // 新增或更新导入记录（同一 URL / 文件路径视为同一条记录）。
  // content 为原始 m3u 文本，用于"导入详情"展示；旧数据可能缺失，查看时再按需获取
  function upsertSource({ type, source, channels, content }) {
    const existing = sources.value.find(s => s.type === type && s.source === source)
    if (existing) {
      existing.channels = channels
      if (content != null) existing.content = content
      touchSource(existing)
    } else {
      sources.value.push({ id: makeId(), type, source, channels, content, importedAt: Date.now() })
    }
  }

  // 弹窗内状态提示
  function setHistoryStatus(text, kind) {
    historyStatus.value = { text, kind }
  }

  // 显示指定导入记录的频道（数据切换后清空播放器悬浮信息与媒体类型标识）。
  // 同时更新 currentSourceId，使导入历史中该记录保持高亮
  function showSourceChannels(src) {
    const channelsStore = useChannelsStore()
    const playerStore = usePlayerStore()
    currentSourceId.value = src ? src.id : null
    channelsStore.setChannels(src ? src.channels : [])
    playerStore.showNowPlaying(null)
    playerStore.showMediaBadge(null)
  }

  // 仅显示最新一次导入的频道（不与历史记录混合）
  function showLatestSource() {
    showSourceChannels(latestSource.value)
  }

  // "应用"：直接显示该条记录本地已保存的数据。
  // 仅展示，不改变记录在导入历史中的顺序（也不更新时间戳）；
  // 本地无数据时先获取再应用
  async function applySource(id) {
    if (historyBusy.value) return // 更新期间禁用
    const src = sources.value.find(s => s.id === id)
    if (!src) return

    if (src.channels && src.channels.length > 0) {
      showSourceChannels(src)
      return
    }

    try {
      const content = await fetchSourceRaw(src)
      const channels = parseM3U(content)
      if (channels.length === 0) {
        alert('未获取到有效频道数据')
        return
      }
      src.channels = channels
      src.content = content
      showSourceChannels(src)
    } catch (err) {
      // 加载失败
    }
  }

  // "更新并应用"：重新获取数据后自动应用（更新本地并设为当前显示）。
  // 更新期间在弹窗内显示进行中提示，并禁用所有历史操作按钮直至结束。
  async function refreshSource(id) {
    if (historyBusy.value) return // 已有更新进行中，忽略重复触发
    const src = sources.value.find(s => s.id === id)
    if (!src) return

    historyBusy.value = true
    setHistoryStatus('正在更新', 'loading')

    try {
      const content = await fetchSourceRaw(src)
      const channels = parseM3U(content)

      if (channels.length === 0) {
        setHistoryStatus('数据未更新（未获取到有效频道）', 'error')
        return
      }

      src.channels = channels
      src.content = content
      touchSource(src)
      showLatestSource()
      setHistoryStatus('更新完成', 'success')
    } catch (err) {
      setHistoryStatus('更新失败', 'error')
    } finally {
      historyBusy.value = false
    }
  }

  // 删除单条导入记录
  function removeSource(id) {
    if (historyBusy.value) return // 更新期间禁用
    sources.value = sources.value.filter(s => s.id !== id)
    showLatestSource()
  }

  // ===== URL 导入 =====
  async function importFromUrl(url) {
    if (!url) {
      alert('请输入播放列表地址')
      return
    }
    try {
      const content = await fetchSourceRaw({ type: 'url', source: url })
      const channels = parseM3U(content)
      if (channels.length === 0) return // 暂无数据
      upsertSource({ type: 'url', source: url, channels, content })
      showLatestSource()
    } catch (err) {
      // 导入失败
    }
  }

  // ===== 文件导入 =====
  async function importFromFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: '播放列表', extensions: ['m3u', 'm3u8', 'txt'] }],
      })
      if (!selected) return

      const content = await readTextFile(selected)
      const channels = parseM3U(content)

      if (channels.length === 0) {
        alert('未找到有效的频道数据，请检查文件格式')
        return
      }

      upsertSource({ type: 'file', source: selected, channels, content })
      showLatestSource()
    } catch (err) {
      // 加载失败
    }
  }

  return {
    sources, historyBusy, historyStatus, latestSource, currentSourceId,
    upsertSource, setHistoryStatus, showLatestSource,
    applySource, refreshSource, removeSource, importFromUrl, importFromFile,
  }
}, {
  persist: { key: 'iptv-sources', pick: ['sources'] },
})
