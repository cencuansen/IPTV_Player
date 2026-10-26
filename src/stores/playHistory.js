import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useFailedChannelsStore } from './failedChannels'

const PLAY_HISTORY_MAX = 100

// 播放历史（最新在前，按 url 去重）
export const usePlayHistoryStore = defineStore('playHistory', () => {
  const playHistory = ref([])
  // "仅有效"过滤开关：只显示未播放失败的频道（会话级状态，不持久化）
  const onlyValid = ref(false)

  // 记录播放历史：按 url 去重，最新播放放首位，超出上限时截断。
  // keepOrder：在"播放历史"分组内播放时保持原有顺序，仅就地更新该条目
  function add(channel, { keepOrder = false } = {}) {
    if (!channel || !channel.url) return
    const idx = playHistory.value.findIndex(c => c.url === channel.url)
    if (idx === -1) {
      playHistory.value.unshift(channel)
    } else if (keepOrder) {
      playHistory.value.splice(idx, 1, channel) // 原位替换
    } else {
      playHistory.value.splice(idx, 1)
      playHistory.value.unshift(channel)
    }
    if (playHistory.value.length > PLAY_HISTORY_MAX) {
      playHistory.value.length = PLAY_HISTORY_MAX
    }
  }

  // 从播放历史中删除单条记录
  function remove(url) {
    playHistory.value = playHistory.value.filter(c => c.url !== url)
  }

  // 清空播放历史
  function clear() {
    playHistory.value = []
  }

  // 切换"仅有效"过滤
  function toggleOnlyValid() {
    onlyValid.value = !onlyValid.value
  }

  // 清除播放历史中的无效频道（播放失败的记录）
  function clearInvalid() {
    const failedSet = new Set(useFailedChannelsStore().failedChannels.map(f => f.url))
    if (!failedSet.size) return
    playHistory.value = playHistory.value.filter(c => !failedSet.has(c.url))
  }

  return { playHistory, onlyValid, add, remove, clear, toggleOnlyValid, clearInvalid }
}, {
  persist: { key: 'iptv-play-history', pick: ['playHistory'] },
})
