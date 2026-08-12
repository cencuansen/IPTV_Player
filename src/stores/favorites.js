import { ref } from 'vue'
import { defineStore } from 'pinia'

// 已收藏频道（最新在前，按 url 去重）
export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref([])

  function isFavorite(channel) {
    return channel && channel.url &&
      favorites.value.some(f => f.url === channel.url)
  }

  // 收藏/取消收藏：按 url 去重，新收藏放首位
  function toggle(channel) {
    if (!channel || !channel.url) return
    const idx = favorites.value.findIndex(f => f.url === channel.url)
    if (idx > -1) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.unshift(channel)
    }
  }

  // 清空全部收藏
  function clear() {
    favorites.value = []
  }

  // 拖拽排序：将 from 处的收藏移动到 to 位置（含越界钳制）
  function move(from, to) {
    const list = favorites.value
    if (from < 0 || from >= list.length) return
    if (to < 0) to = 0
    if (to >= list.length) to = list.length - 1
    if (from === to) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
  }

  return { favorites, isFavorite, toggle, clear, move }
}, {
  persist: { key: 'iptv-favorites', pick: ['favorites'] },
})
