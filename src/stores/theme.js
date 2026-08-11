import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// 主题切换：body[data-theme] 驱动 CSS 变量，持久化到 iptv-theme
export const useThemeStore = defineStore('theme', () => {
  const theme = ref('dark')

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  // 挂载即生效 + 每次切换写回 body（插件自动持久化 theme 字段）
  watch(theme, (t) => {
    document.body.dataset.theme = t
  }, { immediate: true })

  return { theme, toggle }
}, {
  persist: { key: 'iptv-theme', pick: ['theme'] },
})
