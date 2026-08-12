import { ref } from 'vue'
import { defineStore } from 'pinia'

// 播放失败的频道（持久化，按 url 去重，最近失败在前）。
// 同一频道一旦再次成功播放，会自动从列表中清除（自愈），不再标红。
export const useFailedChannelsStore = defineStore('failedChannels', () => {
  const failedChannels = ref([])

  function isFailed(channel) {
    return channel && channel.url &&
      failedChannels.value.some(f => f.url === channel.url)
  }

  // 记录播放失败：按 url 去重，失败时间最新的在前
  function markFailed(channel) {
    if (!channel || !channel.url) return
    const entry = { ...channel, failedAt: Date.now() }
    failedChannels.value = failedChannels.value.filter(f => f.url !== channel.url)
    failedChannels.value.unshift(entry)
  }

  // 播放成功时清除失败标记：同一频道再次可播后不再标红
  function markPlayed(channel) {
    if (!channel || !channel.url) return
    failedChannels.value = failedChannels.value.filter(f => f.url !== channel.url)
  }

  // 清空全部失败记录
  function clear() {
    failedChannels.value = []
  }

  return { failedChannels, isFailed, markFailed, markPlayed, clear }
}, {
  persist: { key: 'iptv-failed-channels', pick: ['failedChannels'] },
})
