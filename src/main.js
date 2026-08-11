import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { normalizeLegacyStorage } from './utils/storage'
import './style.css'
import App from './App.vue'

// 必须先于任何 store 创建：把旧版裸数组/裸字符串存储改写成插件期望的 {字段: 值} 对象形态
normalizeLegacyStorage()

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

createApp(App).use(pinia).mount('#app')
