import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { parseM3U } from '../utils/m3u'
import { fetchSourceRaw } from '../utils/http'
import { makeSourceId } from '../utils/storage'
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

  // 更新时间戳（用于启动时兜底恢复"最近导入"），不改变列表顺序——
  // 导入历史的顺序完全由用户手动拖拽决定
  function touchSource(src) {
    src.importedAt = Date.now()
  }

  // 拖拽排序：将 from 处的记录移动到 to 位置（含越界钳制）
  function moveSource(from, to) {
    const list = sources.value
    if (from < 0 || from >= list.length) return
    if (to < 0) to = 0
    if (to >= list.length) to = list.length - 1
    if (from === to) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
  }

  // 为频道附加来源记录 id（频道列表中展示"来自哪个导入历史"）
  function stampChannels(channels, sourceId) {
    return channels.map(ch => ({ ...ch, sourceId }))
  }

  // 新增或更新导入记录（同一 URL / 文件路径视为同一条记录）。
  // id 由 type + source 派生：同一导入地址/路径永远得到相同的 id。
  // content 为原始 m3u 文本，用于"导入详情"展示；旧数据可能缺失，查看时再按需获取
  function upsertSource({ type, source, channels, content }) {
    const id = makeSourceId(type, source)
    const stamped = stampChannels(channels, id)
    const existing = sources.value.find(s => s.type === type && s.source === source)
    if (existing) {
      existing.channels = stamped
      if (content != null) existing.content = content
      touchSource(existing)
    } else {
      sources.value.push({ id, type, source, channels: stamped, content, importedAt: Date.now() })
    }
  }

  // 弹窗内状态提示
  function setHistoryStatus(text, kind) {
    historyStatus.value = { text, kind }
  }

  // 显示指定导入记录的频道（数据切换会清空媒体类型标识，但保留正在播放的
  // 悬浮信息——它使用播放时写入的独立快照，与当前数据源无关）。
  // 同时更新 currentSourceId，使导入历史中该记录保持高亮
  function showSourceChannels(src) {
    const channelsStore = useChannelsStore()
    const playerStore = usePlayerStore()
    currentSourceId.value = src ? src.id : null
    channelsStore.setChannels(src ? src.channels : [])
    playerStore.showMediaBadge(null)
  }

  // 仅显示最新一次导入的频道（不与历史记录混合）
  function showLatestSource() {
    showSourceChannels(latestSource.value)
  }

  // 启动时恢复上次应用的导入记录：找到匹配 currentSourceId 的记录并复用"应用"逻辑
  // （本地有频道数据则直接展示，无则异步获取后展示）；无匹配记录时返回 false，
  // 由调用方回退到"最新导入"。
  function restoreCurrentSource() {
    if (!currentSourceId.value) return false
    const src = sources.value.find(s => s.id === currentSourceId.value)
    if (!src) return false
    applySource(src.id)
    return true
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
      const channels = stampChannels(parseM3U(content), src.id)
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

  // "更新"：重新获取数据并写回本地，不自动应用（不切换当前显示的频道）。
  // 更新期间在弹窗内显示进行中提示，并禁用所有历史操作按钮直至结束。
  async function refreshSource(id) {
    if (historyBusy.value) return // 已有更新进行中，忽略重复触发
    const src = sources.value.find(s => s.id === id)
    if (!src) return

    historyBusy.value = true
    setHistoryStatus('正在更新', 'loading')

    try {
      const content = await fetchSourceRaw(src)
      const channels = stampChannels(parseM3U(content), src.id)

      if (channels.length === 0) {
        setHistoryStatus('数据未更新（未获取到有效频道）', 'error')
        return
      }

      src.channels = channels
      src.content = content
      touchSource(src)
      setHistoryStatus('更新完成', 'success') // 仅更新数据，点击该记录才会应用
    } catch (err) {
      setHistoryStatus('更新失败', 'error')
    } finally {
      historyBusy.value = false
    }
  }

  // 删除单条导入记录（仅删除当前正在显示的记录时才切换频道数据）
  function removeSource(id) {
    if (historyBusy.value) return // 更新期间禁用
    const wasCurrent = currentSourceId.value === id
    sources.value = sources.value.filter(s => s.id !== id)
    if (wasCurrent) showLatestSource()
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
      if (channels.length === 0) {
        alert('未获取到有效的频道数据，请检查地址内容是否为 M3U / TXT 播放列表')
        return
      }
      upsertSource({ type: 'url', source: url, channels, content })
      showLatestSource()
    } catch (err) {
      // 明确提示失败原因（网络、HTTP 状态等），避免"点了没反应"
      alert('导入失败：' + (err && err.message ? err.message : err))
    }
  }

  // ===== 文件导入 =====
  async function importFromFile() {
    try {
      const selected = await open({
        multiple: false,
        // 扩展名不代表内容格式：TXT/其他文本文件里也可能是 m3u 列表，
        // 因此除常见扩展名外允许选择所有文件（由内容解析判断是否有效）
        filters: [
          { name: '播放列表', extensions: ['m3u', 'm3u8', 'txt', 'list'] },
          { name: '所有文件', extensions: ['*'] },
        ],
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
      alert('导入失败：' + (err && err.message ? err.message : err))
    }
  }

  return {
    sources, historyBusy, historyStatus, latestSource, currentSourceId,
    upsertSource, setHistoryStatus, showLatestSource, restoreCurrentSource,
    applySource, refreshSource, removeSource, moveSource, importFromUrl, importFromFile,
  }
}, {
  // currentSourceId 一并持久化：重启后可按上次应用的记录恢复频道
  persist: { key: 'iptv-sources', pick: ['sources', 'currentSourceId'] },
})
