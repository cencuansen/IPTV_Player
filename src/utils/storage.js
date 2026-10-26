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
// 导入记录 id：由类型（url/file）+ 地址/路径派生，同一输入永远得到同一 id
// （同样的导入地址/路径可重复得到相同 id，便于识别与去重）。固定 5 位大写的 36 进制字符
export function makeSourceId(type, source) {
  const input = `${type}:${source}`
  // FNV-1a 64 位哈希（BigInt），取低位 5 位 36 进制字符作为短 id
  let hash = 14695981039346656037n
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn
  }
  return hash.toString(36).padStart(5, '0').slice(-5).toUpperCase()
}

// 导入记录 id 迁移（幂等）：旧版随机 id → 由 type + source 派生的稳定 id；
// 同时给各记录内的频道补上 sourceId（频道列表据此展示来源记录），
// 收藏 / 播放历史中保存的频道副本按 url 补 sourceId。
export function migrateSourceIds() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.sources)) return

  const oldToNew = new Map()
  const urlToId = new Map()
  let changed = false

  for (const src of data.sources) {
    if (!src || !src.type || typeof src.source !== 'string') continue
    const id = makeSourceId(src.type, src.source)
    if (src.id !== id) {
      if (src.id) oldToNew.set(src.id, id)
      src.id = id
      changed = true
    }
    for (const ch of src.channels || []) {
      if (!ch) continue
      if (ch.sourceId !== id) {
        ch.sourceId = id
        changed = true
      }
      if (ch.url && !urlToId.has(ch.url)) urlToId.set(ch.url, id)
    }
  }

  // 当前显示记录引用旧 id 时同步改写
  if (data.currentSourceId && oldToNew.has(data.currentSourceId)) {
    data.currentSourceId = oldToNew.get(data.currentSourceId)
    changed = true
  }

  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

  // 收藏 / 播放历史：频道副本按 url 关联到来源记录
  fillChannelSourceIds(PLAY_HISTORY_KEY, 'playHistory', urlToId)
  fillChannelSourceIds(FAVORITES_KEY, 'favorites', urlToId)
}

function fillChannelSourceIds(key, field, urlToId) {
  if (!urlToId.size) return
  const raw = localStorage.getItem(key)
  if (!raw) return
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return
  }
  const list = data && data[field]
  if (!Array.isArray(list)) return

  let changed = false
  for (const ch of list) {
    if (!ch || !ch.url) continue
    const id = urlToId.get(ch.url)
    // 同时修正旧版（更长）id 遗留的副本
    if (id && ch.sourceId !== id) {
      ch.sourceId = id
      changed = true
    }
  }
  if (changed) localStorage.setItem(key, JSON.stringify(data))
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
