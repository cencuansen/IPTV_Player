// ===== 网络/文件读取（Tauri 插件 API）=====
import { fetch } from '@tauri-apps/plugin-http'
import { readTextFile } from '@tauri-apps/plugin-fs'

export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// 通过 tauri-plugin-http（Rust 后端）请求，绕过浏览器 CORS，返回文本
export async function fetchRaw(url, { timeout = 30000 } = {}) {
  const response = await fetch(url, { method: 'GET', connectTimeout: timeout })
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
  return await response.text()
}

// 重新获取某条导入记录的原始内容（URL 或文件），返回 m3u 文本
export async function fetchSourceRaw(src) {
  if (src.type === 'url') return fetchRaw(src.source)
  return readTextFile(src.source)
}
