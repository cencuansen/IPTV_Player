import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Tauri 要求固定的 dev server 端口（devUrl 指向这里），并忽略 Rust 侧文件变更
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
