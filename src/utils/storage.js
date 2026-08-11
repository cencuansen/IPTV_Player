// ===== 本地持久化 key =====
export const STORAGE_KEY = 'iptv-sources'
export const PLAY_HISTORY_KEY = 'iptv-play-history'
export const FAVORITES_KEY = 'iptv-favorites'
export const THEME_KEY = 'iptv-theme'

// ===== 旧数据迁移 =====
// 旧版应用把数据以"裸数组/裸字符串"直接存进 localStorage；
// pinia-plugin-persistedstate v4 存的是 { 字段: 值 } 对象。启动期做一次幂等改写，
// 否则插件按字段名取值会拿到 undefined，导致老用户已导入的数据"看起来丢了"。
const LEGACY_MAP = [
  { key: STORAGE_KEY,       field: 'sources',     kind: 'array' },
  { key: PLAY_HISTORY_KEY,  field: 'playHistory', kind: 'array' },
  { key: FAVORITES_KEY,     field: 'favorites',   kind: 'array' },
  { key: THEME_KEY,         field: 'theme',       kind: 'string' },
]

export function normalizeLegacyStorage() {
  for (const { key, field, kind } of LEGACY_MAP) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    let val
    try {
      val = JSON.parse(raw)
    } catch {
      val = raw // 裸字符串（如 "dark"）JSON.parse 会抛错，原样保留
    }
    // 已是插件形态（对象且含目标字段）→ 跳过（幂等，避免每次启动重写）
    if (val && typeof val === 'object' && !Array.isArray(val) && field in val) continue
    const ok = kind === 'array' ? Array.isArray(val) : (typeof val === 'string' && !!val)
    if (ok) localStorage.setItem(key, JSON.stringify({ [field]: val }))
  }
}

// ===== 通用工具 =====
export function makeId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// URL 显示时解码百分号编码（如 %E7%9B%B4%E6%92%AD → 直播）；含非法序列时原样返回
export function decodeUrlForDisplay(url) {
  try {
    return decodeURI(url)
  } catch (err) {
    return url
  }
}
