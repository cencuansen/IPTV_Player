import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { invoke } from '@tauri-apps/api/core'
import { normalizeLegacyStorage, migrateSourceIds } from './utils/storage'
import './style.css'
import App from './App.vue'

// 必须先于任何 store 创建：把旧版裸数组/裸字符串存储改写成插件期望的 {字段: 值} 对象形态
normalizeLegacyStorage()
// 再把导入记录的随机 id 改写为由导入地址/路径派生的稳定 id（幂等）
migrateSourceIds()

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 开发模式：F12 打开/关闭开发者工具（生产构建不注册该监听）
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F12' || e.repeat) return
    e.preventDefault()
    e.stopPropagation()
    invoke('toggle_devtools').catch(() => { /* 非 Tauri 环境（纯浏览器预览）忽略 */ })
  }, true)
}

createApp(App).use(pinia).mount('#app')
