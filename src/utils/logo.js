// ===== 频道 Logo 处理 =====

// 中转地址（如 https://mirror.ghproxy.com/https://raw.githubusercontent.com/...）时，
// 取其路径中的真实目标地址；非中转地址原样返回
export function getRealLogoUrl(url) {
  const m = /^https?:\/\/[^/]+\/(https?:\/\/.+)$/i.exec(String(url))
  return m ? m[1] : url
}

// Logo 预加载结果缓存：同一会话内每个 URL 只探测一次，
// 避免分组切换/搜索/重新导入导致组件重建时重复网络请求。
// value: Promise<boolean> —— 探测中并发调用共享同一个 Promise，resolve 后永久命中。
const probeCache = new Map()
const PROBE_CACHE_MAX = 500 // 上限保护，防止频道列表反复导入时缓存无界增长

function cacheLogoProbe(url, promise) {
  probeCache.set(url, promise)
  if (probeCache.size > PROBE_CACHE_MAX) {
    // Map 迭代顺序即插入顺序，删除最早插入的一项
    probeCache.delete(probeCache.keys().next().value)
  }
}

// 探测单个 URL 能否加载成功（成功 resolve true，失败 false，不抛出）
export function probeLogo(url) {
  if (!url) return Promise.resolve(false)
  if (probeCache.has(url)) return probeCache.get(url)

  const promise = new Promise((resolve) => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer' // 与渲染 <img> 一致，保证探测结果与最终渲染一致
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
  cacheLogoProbe(url, promise)
  return promise
}

// 频道 Logo 加载失败时的默认占位图（内联 SVG，不依赖外部资源）
export const DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70">' +
  '<rect x="4" y="8" width="112" height="54" rx="6" fill="#2d3748" stroke="#718096" stroke-width="4"/>' +
  '<line x1="40" y1="8" x2="28" y2="0" stroke="#718096" stroke-width="4" stroke-linecap="round"/>' +
  '<line x1="80" y1="8" x2="92" y2="0" stroke="#718096" stroke-width="4" stroke-linecap="round"/>' +
  '<circle cx="60" cy="35" r="13" fill="none" stroke="#a0aec0" stroke-width="3"/>' +
  '<line x1="53" y1="35" x2="67" y2="35" stroke="#a0aec0" stroke-width="3"/>' +
  '<line x1="60" y1="28" x2="60" y2="42" stroke="#a0aec0" stroke-width="3"/>' +
  '</svg>'
)
