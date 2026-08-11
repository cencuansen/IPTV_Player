import { ref } from 'vue'
import { defineStore } from 'pinia'

const PLAY_HISTORY_MAX = 100

// 播放历史（最新在前，按 url 去重）
export const usePlayHistoryStore = defineStore('playHistory', () => {
  const playHistory = ref([])

  // 记录播放历史：按 url 去重，最新播放放首位，超出上限时截断
  function add(channel) {
    if (!channel || !channel.url) return
    playHistory.value = playHistory.value.filter(c => c.url !== channel.url)
    playHistory.value.unshift(channel)
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

  return { playHistory, add, remove, clear }
}, {
  persist: { key: 'iptv-play-history', pick: ['playHistory'] },
})
