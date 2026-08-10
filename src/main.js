// ===== 状态管理 =====
const state = {
  channels: [],         // 当前显示来源的全部频道
  groups: [],           // [{ name, count }]，按频道数降序
  groupMap: {},         // { 分组名: [频道, ...] }，每个分组对应的频道
  expanded: new Set(['全部频道']), // 已展开的分组
  groupPages: {},       // { 分组名: 页码 }，每组独立分页
  searchKeyword: '',
  pageSize: 10,         // 每个分组内每页显示的频道数
  currentChannel: null,
  hls: null,
  sources: [], // 导入记录：[{ id, type: 'url'|'file', source, importedAt, channels: [] }]
  playHistory: [], // 播放历史（最新在前，按 url 去重）
}

// ===== DOM 元素 =====
const elements = {
  importFileBtn: document.getElementById('importFileBtn'),
  importUrlBtn: document.getElementById('importUrlBtn'),
  themeToggle: document.getElementById('themeToggle'),
  searchInput: document.getElementById('searchInput'),
  groupList: document.getElementById('groupList'),
  totalCount: document.getElementById('totalCount'),
  videoPlayer: document.getElementById('videoPlayer'),
  playerPlaceholder: document.getElementById('playerPlaceholder'),
  nowPlaying: document.getElementById('nowPlaying'),
  nowPlayingGroups: document.getElementById('nowPlayingGroups'),
  nowPlayingTitle: document.getElementById('nowPlayingTitle'),
  mediaBadge: document.getElementById('mediaBadge'),
  statusText: document.getElementById('statusText'),
  urlModal: document.getElementById('urlModal'),
  urlInput: document.getElementById('urlInput'),
  closeUrlModal: document.getElementById('closeUrlModal'),
  cancelUrlBtn: document.getElementById('cancelUrlBtn'),
  confirmUrlBtn: document.getElementById('confirmUrlBtn'),
  historyBtn: document.getElementById('historyBtn'),
  historyModal: document.getElementById('historyModal'),
  historyList: document.getElementById('historyList'),
  historyStatus: document.getElementById('historyStatus'),
  closeHistoryModal: document.getElementById('closeHistoryModal'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
}

// ===== 工具函数 =====
function setStatus(text) {
  // elements.statusText.textContent = text
}

// 视频顶部悬浮显示当前播放信息（分组 + 频道名），水平居中；无频道时隐藏
function showNowPlaying(channel) {
  if (!channel) {
    elements.nowPlaying.style.display = 'none'
    return
  }
  const groups = channelGroups(channel)
  elements.nowPlayingGroups.textContent = groups.join(' · ')
  elements.nowPlayingTitle.textContent = channel.name
  elements.nowPlayingTitle.title = channel.name
  elements.nowPlaying.style.display = 'flex'
}

// 媒体类型判断（仅按 URL）：明确的点播视频扩展名 → 视频；其余 → 直播。
// 注意：.m3u8 可能是直播也可能是点播，最终需等清单加载后按片段时间重判。
function getMediaType(url) {
  const path = String(url || '').split(/[?#]/)[0].toLowerCase()
  const m = /\.([a-z0-9]{2,5})$/.exec(path)
  const ext = m ? m[1] : ''
  const VIDEO_EXTS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'mpg', 'mpeg', '3gp']
  return VIDEO_EXTS.includes(ext) ? '视频' : '直播'
}

// 按 hls.js 解析出的清单信息推断直播/视频。
// 优先级：
//  1) hls.js 计算好的 details.live === false（VOD 类型或带 #EXT-X-ENDLIST）→ 视频
//  2) 清单声明 type === 'VOD'，或存在 #EXT-X-ENDLIST → 视频
//  3) 存在超长整段片段（≥2 分钟，如整集/整部作为一个切片）→ 视频
//  4) 其余（片段通常只有几秒）→ 直播
function determineHlsType(details) {
  if (!details) return '直播'
  if (details.live === false || details.type === 'VOD' || details.endedlist === true) return '视频'
  let maxDur = 0
  const fragments = details.fragments || []
  for (const f of fragments) {
    if (f && typeof f.duration === 'number' && f.duration > maxDur) maxDur = f.duration
  }
  return maxDur >= 60 ? '视频' : '直播'
}

// .m3u8 清单加载后推断出的媒体类型；正常播放（video playing）后才用于显示徽标。
// 播放前保持 null，确保未正常播放时徽标不显示。
let pendingMediaType = null

// 视频区域顶部右侧显示媒体类型徽标；无频道时隐藏。forcedType 用于 .m3u8
// 在清单加载后覆盖初始判断（初始按 URL 推断为直播，再按片段时间纠正）。
function showMediaBadge(channel, forcedType) {
  if (!channel) {
    elements.mediaBadge.style.display = 'none'
    return
  }
  const type = forcedType || getMediaType(channel.url)
  elements.mediaBadge.textContent = type
  elements.mediaBadge.className = 'media-badge ' + (type === '直播' ? 'live' : 'vod')
  elements.mediaBadge.style.display = 'inline-flex'
}

// 中转地址（如 https://mirror.ghproxy.com/https://raw.githubusercontent.com/...）时，
// 取其路径中的真实目标地址；非中转地址原样返回
function getRealLogoUrl(url) {
  const m = /^https?:\/\/[^/]+\/(https?:\/\/.+)$/i.exec(String(url))
  return m ? m[1] : url
}

// 频道 Logo 加载失败时的默认占位图（内联 SVG，不依赖外部资源）
const DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70">' +
  '<rect x="4" y="8" width="112" height="54" rx="6" fill="#2d3748" stroke="#718096" stroke-width="4"/>' +
  '<line x1="40" y1="8" x2="28" y2="0" stroke="#718096" stroke-width="4" stroke-linecap="round"/>' +
  '<line x1="80" y1="8" x2="92" y2="0" stroke="#718096" stroke-width="4" stroke-linecap="round"/>' +
  '<circle cx="60" cy="35" r="13" fill="none" stroke="#a0aec0" stroke-width="3"/>' +
  '<line x1="53" y1="35" x2="67" y2="35" stroke="#a0aec0" stroke-width="3"/>' +
  '<line x1="60" y1="28" x2="60" y2="42" stroke="#a0aec0" stroke-width="3"/>' +
  '</svg>'
)

// ===== M3U 解析器 =====
function parseM3U(content) {
  const lines = content.split('\n')
  const channels = []
  let currentChannel = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('#EXTINF:')) {
      // 解析 EXTINF 行
      const info = line.substring(8)
      const commaIndex = info.lastIndexOf(',')
      const name = commaIndex > -1 ? info.substring(commaIndex + 1).trim() : '未知频道'

      // 解析属性
      const attrs = {}
      const attrStr = commaIndex > -1 ? info.substring(0, commaIndex) : info
      const attrRegex = /([a-zA-Z-]+)="([^"]*)"/g
      let match
      while ((match = attrRegex.exec(attrStr)) !== null) {
        attrs[match[1].toLowerCase()] = match[2]
      }

      // group-title 可能用多种分隔符表示多个分组，拆成数组
      // （如 "体育,央视"、"体育;央视"、"体育，央视"、"体育|央视" → ['体育','央视']）
      const rawGroup = attrs['group-title'] || '未分组'
      const groups = splitGroups(rawGroup)

      currentChannel = {
        name: name,
        logo: attrs['tvg-logo'] || '',
        groups: groups.length ? groups : ['未分组'],
        group: groups[0] || '未分组', // 主分组（用于卡片展示，兼容旧数据）
        url: '',
      }
    } else if (line && !line.startsWith('#') && currentChannel) {
      // URL 行
      currentChannel.url = line
      channels.push(currentChannel)
      currentChannel = null
    }
  }

  return channels
}

// 按多种分隔符拆分分组字符串（半角/全角逗号、分号、竖线）
function splitGroups(raw) {
  return String(raw).split(/[,;|，；]/).map(g => g.trim()).filter(Boolean)
}

// 返回频道所属的所有分组（新数据用 groups 数组；旧本地数据只有 group 字符串，也按相同规则拆分）
function channelGroups(ch) {
  if (Array.isArray(ch.groups) && ch.groups.length) return ch.groups
  const split = splitGroups(ch.group || '未分组')
  return split.length ? split : ['未分组']
}

// ===== 数据合并与本地持久化 =====
const STORAGE_KEY = 'iptv-sources'

function makeId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// URL 显示时解码百分号编码（如 %E7%9B%B4%E6%92%AD → 直播）；含非法序列时原样返回
function decodeUrlForDisplay(url) {
  return decodeURI(url)
}

function saveSources() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sources))
  } catch (err) {
    setStatus(`无法缓存`)
  }
}

function loadPersistedSources() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) state.sources = parsed
  } catch (err) {
    state.sources = []
  }
}

// ===== 播放历史持久化 =====
const PLAY_HISTORY_KEY = 'iptv-play-history'
const PLAY_HISTORY_MAX = 100

function savePlayHistory() {
  try {
    localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(state.playHistory))
  } catch (err) {
  }
}

function loadPlayHistory() {
  try {
    const raw = localStorage.getItem(PLAY_HISTORY_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) state.playHistory = parsed
  } catch (err) {
    state.playHistory = []
  }
}

// 记录播放历史：按 url 去重，最新播放放首位，超出上限时截断
function addToHistory(channel) {
  if (!channel || !channel.url) return
  state.playHistory = state.playHistory.filter(c => c.url !== channel.url)
  state.playHistory.unshift(channel)
  if (state.playHistory.length > PLAY_HISTORY_MAX) {
    state.playHistory.length = PLAY_HISTORY_MAX
  }
  savePlayHistory()
}

// 将记录置为“最新”：更新时间戳并移到列表末尾
function touchSource(src) {
  src.importedAt = Date.now()
  state.sources = state.sources.filter(s => s !== src)
  state.sources.push(src)
}

// 新增或更新导入记录（同一 URL / 文件路径视为同一条记录）
function upsertSource({ type, source, channels }) {
  const existing = state.sources.find(s => s.type === type && s.source === source)
  if (existing) {
    existing.channels = channels
    touchSource(existing)
  } else {
    state.sources.push({ id: makeId(), type, source, channels, importedAt: Date.now() })
  }
  saveSources()
}

// 最新一次导入的记录（importedAt 相同时取更靠后的，即最近插入）
function latestSource() {
  let latest = null
  for (const s of state.sources) {
    if (!latest || s.importedAt >= latest.importedAt) latest = s
  }
  return latest
}

// 仅显示最新一次导入的频道（不与历史记录混合）
function showLatestSource() {
  const latest = latestSource()
  state.channels = latest ? latest.channels : []
  state.searchKeyword = ''
  elements.searchInput.value = ''
  state.expanded = new Set(['全部频道'])
  state.groupPages = {}
  updateGroups()
  elements.totalCount.textContent = `${state.channels.length} 个频道`
  showNowPlaying(null) // 数据切换后清空悬浮信息
  showMediaBadge(null) // 隐藏媒体类型标识
  setStatus(`就绪`)
  if (elements.historyModal && elements.historyModal.style.display === 'flex') {
    renderHistory()
  }
}

// 重新获取某条导入记录的数据（URL 或文件），解析为频道列表
async function fetchSourceChannels(src) {
  if (src.type === 'url') {
    const { fetch } = window.__TAURI__.http
    const response = await fetch(src.source, { method: 'GET', connectTimeout: 30000 })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    const content = await response.text()
    return parseM3U(content)
  }
  const { readTextFile } = window.__TAURI__.fs
  return parseM3U(await readTextFile(src.source))
}

// "应用"：直接显示本地已保存的数据；本地无数据时先获取再应用
async function applySource(id) {
  if (historyBusy) return // 更新期间禁用
  const src = state.sources.find(s => s.id === id)
  if (!src) return

  if (src.channels && src.channels.length > 0) {
    touchSource(src)
    saveSources()
    showLatestSource()
    setStatus(`就绪`)
    return
  }

  setStatus('获取数据...')
  try {
    const channels = await fetchSourceChannels(src)
    if (channels.length === 0) {
      alert('未获取到有效频道数据')
      setStatus('暂无数据')
      return
    }
    src.channels = channels
    touchSource(src)
    saveSources()
    showLatestSource()
    setStatus(`就绪`)
  } catch (err) {
    setStatus(`加载失败`)
  }
}

// "更新并应用"：重新获取数据后自动应用（更新本地并设为当前显示）。
// 更新期间在弹窗内显示进行中提示，并禁用所有历史操作按钮直至结束。
async function refreshSource(id) {
  if (historyBusy) return // 已有更新进行中，忽略重复触发
  const src = state.sources.find(s => s.id === id)
  if (!src) return

  historyBusy = true
  setHistoryStatus(`正在更新`, 'loading')
  renderHistory() // 重渲染以禁用弹窗内所有操作按钮

  try {
    const channels = await fetchSourceChannels(src)

    if (channels.length === 0) {
      setHistoryStatus('数据未更新（未获取到有效频道）', 'error')
      return
    }

    src.channels = channels
    touchSource(src)
    saveSources()
    showLatestSource()
    setHistoryStatus(`更新完成`, 'success')
  } catch (err) {
    setHistoryStatus(`更新失败`, 'error')
  } finally {
    historyBusy = false
    renderHistory() // 恢复按钮可用
  }
}

// 删除单条导入记录
function removeSource(id) {
  if (historyBusy) return // 更新期间禁用
  const src = state.sources.find(s => s.id === id)
  state.sources = state.sources.filter(s => s.id !== id)
  saveSources()
  showLatestSource()
}

// ===== 渲染函数 =====

// 重新统计分组，重建整个手风琴列表
function updateGroups() {
  const map = {}
  state.channels.forEach(ch => {
    channelGroups(ch).forEach(g => {
      if (!map[g]) map[g] = []
      map[g].push(ch)
    })
  })

  state.groupMap = map
  state.groups = Object.entries(map)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => ({ name, count: list.length }))

  renderGroups()
}

// 关键词匹配频道名或任一所属分组
function matchesSearch(ch, keyword) {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  return ch.name.toLowerCase().includes(k) ||
    channelGroups(ch).some(g => g.toLowerCase().includes(k))
}

// 获取某分组在当前搜索条件下的频道列表（"全部频道"为所有频道，"播放历史"取历史记录）
function getGroupChannels(groupName) {
  let all
  if (groupName === '全部频道') all = state.channels
  else if (groupName === '播放历史') all = state.playHistory
  else all = state.groupMap[groupName] || []
  if (!state.searchKeyword) return all
  return all.filter(ch => matchesSearch(ch, state.searchKeyword))
}

// 重建整个手风琴列表（用于数据/搜索变化时的整体刷新）
function renderGroups() {
  const container = elements.groupList
  container.innerHTML = ''

  // "播放历史" 固定在最上方（最新播放的在最前）
  renderGroupSection(container, '播放历史', getGroupChannels('播放历史'))

  if (state.channels.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.innerHTML = `
      <p>暂无频道数据</p>
      <p class="empty-hint">点击右上角「文件导入」或「URL导入」添加播放列表</p>
    `
    container.appendChild(empty)
    return
  }

  // "全部频道" 固定其后
  renderGroupSection(container, '全部频道', getGroupChannels('全部频道'))

  state.groups.forEach(group => {
    renderGroupSection(container, group.name, getGroupChannels(group.name))
  })
}

// 渲染单个分组节：头部（点击展开/收起）+ 展开时的频道列表与分页
function renderGroupSection(container, groupName, channels) {
  const searching = !!state.searchKeyword
  // 搜索时：无匹配的分组隐藏，有匹配的分组强制展开
  if (searching && channels.length === 0) return

  const expanded = state.expanded.has(groupName) || (searching && channels.length > 0)

  const section = document.createElement('div')
  section.className = 'group-section' + (expanded ? ' expanded' : '')
  section.dataset.group = groupName

  const header = document.createElement('div')
  header.className = 'group-section-header'
  header.title = groupName
  header.innerHTML = `
    <span class="group-caret">${expanded ? '▾' : '▸'}</span>
    <span class="group-name">${groupName}</span>
    <span class="group-count">${channels.length}</span>
  `
  section.appendChild(header)

  if (expanded) {
    section.appendChild(createGroupBody(groupName, channels))
  }

  container.appendChild(section)
}

// 构建分组展开区：当前页频道 + 分页控件
function createGroupBody(groupName, channels) {
  const total = channels.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  let page = state.groupPages[groupName] || 1
  if (page > totalPages) page = totalPages
  state.groupPages[groupName] = page

  const start = (page - 1) * state.pageSize
  const pageChannels = channels.slice(start, start + state.pageSize)

  const body = document.createElement('div')
  body.className = 'group-section-body'

  const list = document.createElement('div')
  list.className = 'group-channels'
  pageChannels.forEach(ch => list.appendChild(createChannelCard(ch)))
  body.appendChild(list)

  if (totalPages > 1) {
    body.appendChild(createGroupPagination(groupName, page, totalPages))
  }

  return body
}

// 分页控件：‹ 页码… ›，页码/按钮通过 data-page 交给委托处理
function createGroupPagination(groupName, page, totalPages) {
  const pag = document.createElement('div')
  pag.className = 'group-pagination'

  const prev = document.createElement('button')
  prev.className = 'btn btn-sm'
  prev.textContent = '‹'
  prev.dataset.group = groupName
  prev.dataset.page = String(page - 1)
  prev.disabled = page <= 1
  pag.appendChild(prev)

  const maxVisible = 5
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
  let endPage = Math.min(totalPages, startPage + maxVisible - 1)
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('span')
    btn.className = 'page-btn'
    if (i === page) btn.classList.add('active')
    btn.textContent = i
    btn.dataset.group = groupName
    btn.dataset.page = String(i)
    pag.appendChild(btn)
  }

  const next = document.createElement('button')
  next.className = 'btn btn-sm'
  next.textContent = '›'
  next.dataset.group = groupName
  next.dataset.page = String(page + 1)
  next.disabled = page >= totalPages
  pag.appendChild(next)

  return pag
}

// 创建单个频道卡片（点击播放通过事件委托处理）
function createChannelCard(channel) {
  const card = document.createElement('div')
  card.className = 'channel-card'
  card._channel = channel // 记录频道，供高亮更新用，避免重建 DOM
  if (state.currentChannel && state.currentChannel.url === channel.url) {
    card.classList.add('playing')
  }

  // Logo：始终显示，加载失败时回退到默认占位图
  const img = document.createElement('img')
  img.className = 'channel-logo'
  img.alt = ''
  img.loading = 'lazy'
  // 不发送 Referer：避免 strict-origin-when-cross-origin 提示，
  // 也兼容按 Referer 防盗链的 logo 服务器
  img.referrerPolicy = 'no-referrer'
  // 若为中转地址，先尝试其真实目标地址；失败再退回原始地址
  const logoUrl = channel.logo || ''
  const realLogo = getRealLogoUrl(logoUrl)
  img.src = realLogo || DEFAULT_LOGO
  img.onerror = () => {
    img.onerror = null
    if (logoUrl && realLogo !== logoUrl) {
      img.src = logoUrl
      img.onerror = () => {
        img.onerror = null
        img.src = DEFAULT_LOGO
      }
    } else {
      img.src = DEFAULT_LOGO
    }
  }

  const name = document.createElement('div')
  name.className = 'channel-name'
  name.title = channel.name
  name.textContent = channel.name

  const group = document.createElement('div')
  group.className = 'channel-group'
  group.textContent = channelGroups(channel).join(' · ')

  const info = document.createElement('div')
  info.className = 'channel-info'
  info.appendChild(name)
  info.appendChild(group)

  card.appendChild(img)
  card.appendChild(info)

  return card
}

// 只更新当前播放卡片的 .playing 高亮，不重建 DOM（避免 logo 重新加载）
function updatePlayingHighlight() {
  const cards = elements.groupList.querySelectorAll('.channel-card')
  for (const card of cards) {
    const isPlaying = state.currentChannel && card._channel &&
      card._channel.url === state.currentChannel.url
    card.classList.toggle('playing', !!isPlaying)
  }
}

// 展开/收起分组（局部更新，不影响其他分组，避免 logo 重新加载）
function toggleGroup(groupName) {
  const section = elements.groupList.querySelector(`.group-section[data-group="${groupName}"]`)
  if (!section) return

  if (state.expanded.has(groupName)) {
    state.expanded.delete(groupName)
    section.classList.remove('expanded')
    const body = section.querySelector('.group-section-body')
    if (body) body.remove()
    const caret = section.querySelector('.group-caret')
    if (caret) caret.textContent = '▸'
  } else {
    state.expanded.add(groupName)
    section.classList.add('expanded')
    const caret = section.querySelector('.group-caret')
    if (caret) caret.textContent = '▾'
    section.appendChild(createGroupBody(groupName, getGroupChannels(groupName)))
  }
}

// 切换某分组页码（只重建该分组展开区）
function goToGroupPage(groupName, page) {
  const section = elements.groupList.querySelector(`.group-section[data-group="${groupName}"]`)
  if (!section) return
  state.groupPages[groupName] = page
  const body = createGroupBody(groupName, getGroupChannels(groupName))
  const oldBody = section.querySelector('.group-section-body')
  if (oldBody) section.replaceChild(body, oldBody)
}

// 播放后局部刷新"播放历史"分组（仅当该分组展开时重建其展开区，
// 避免整体重绘导致其他分组 logo 重新加载）
function refreshHistorySection(channel) {
  const section = elements.groupList.querySelector('.group-section[data-group="播放历史"]')
  if (!section) return

  // 始终更新计数徽标（考虑搜索过滤后的数量）
  const countEl = section.querySelector('.group-count')
  if (countEl) countEl.textContent = getGroupChannels('播放历史').length

  if (!section.classList.contains('expanded')) return

  // 若该频道本就是第 1 页首条（重复播放同一频道），无需重建
  const list = section.querySelector('.group-channels')
  const first = list && list.firstChild
  if (first && first._channel && first._channel.url === channel.url) return

  const body = createGroupBody('播放历史', getGroupChannels('播放历史'))
  const oldBody = section.querySelector('.group-section-body')
  if (oldBody) section.replaceChild(body, oldBody)
  else section.appendChild(body)
}

// ===== HLS 加载器：通过 tauri-plugin-http（Rust 后端）请求，绕过浏览器 CORS =====
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

class TauriHttpLoader {
  constructor(config) {
    this.config = config || {}
    this.controller = null
    this.timer = null
    this.stats = null
    this.destroyed = false
  }

  destroy() {
    this.destroyed = true
    this.abort()
  }

  abort() {
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.stats) this.stats.aborted = true
  }

  load(context, config, callbacks) {
    if (this.destroyed) return
    this.abort()

    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const stats = {
      aborted: false,
      loaded: 0,
      retry: 0,
      total: 0,
      chunkCount: 0,
      bwEstimate: 0,
      loading: { start: now(), first: 0, end: 0 },
      parsing: { start: 0, end: 0 },
      buffering: { start: 0, end: 0 },
    }
    this.stats = stats
    this.controller = new AbortController()

    const timeout = (config && config.timeout) || 30000
    this.timer = setTimeout(() => {
      this.abort()
      callbacks.onTimeout(stats, context)
    }, timeout)

    const headers = {
      'User-Agent': BROWSER_UA,
    }
    if (context.range) {
      headers['Range'] = `bytes=${context.range.start}-${context.range.end}`
    }
    if (context.headers) {
      Object.assign(headers, context.headers)
    }

    window.__TAURI__.http.fetch(context.url, {
      method: 'GET',
      signal: this.controller.signal,
      headers,
      connectTimeout: 15000,
    })
      .then(async (response) => {
        if (this.destroyed || stats.aborted) return
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
        const buf = await response.arrayBuffer()
        if (this.destroyed || stats.aborted) return
        clearTimeout(this.timer)
        stats.loaded = buf.byteLength
        stats.total = buf.byteLength
        stats.chunkCount = 1
        stats.loading.first = stats.loading.start
        stats.loading.end = now()
        const data = context.responseType === 'text'
          ? new TextDecoder('utf-8').decode(buf)
          : buf
        callbacks.onSuccess({ url: context.url, data }, stats, context, response)
      })
      .catch((err) => {
        if (this.destroyed || stats.aborted) return
        if (err && err.name === 'AbortError') return
        clearTimeout(this.timer)
        callbacks.onError(
          { code: 0, text: (err && err.message) || String(err) },
          context,
          undefined,
          stats
        )
      })
  }
}

// ===== 播放功能 =====
function playChannel(channel) {
  state.currentChannel = channel

  // 更新 UI
  elements.playerPlaceholder.style.display = 'none'
  elements.videoPlayer.classList.add('active')

  // 销毁之前的 HLS 实例
  if (state.hls) {
    state.hls.destroy()
    state.hls = null
  }

  const video = elements.videoPlayer
  const url = channel.url

  // 检查是否是 HLS 流
  if (url.includes('.m3u8') && window.Hls && Hls.isSupported()) {
    // 使用自定义加载器：经 Rust 后端请求，绕过浏览器 CORS
    state.hls = new Hls({ loader: TauriHttpLoader })
    let mediaTypeSettled = false
    // 清单加载后按片段时间推断直播/视频（仅一次）。只记录到 pendingMediaType，
    // 待视频真正开始播放（playing）后才显示徽标。
    // hls.js 的 on() 回调只接收一个 data 参数，(event, data) 中 data 为 undefined，
    // 故用 data || event 兼容取到清单详情，避免推断失效。
    state.hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
      const info = data || event
      if (mediaTypeSettled || !info || !info.details) return
      mediaTypeSettled = true
      pendingMediaType = determineHlsType(info.details)
    })
    state.hls.loadSource(url)
    state.hls.attachMedia(video)
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => {
        if (state.hls) {
          state.hls.destroy()
          state.hls = null
        }
      })
    })
    state.hls.on(Hls.Events.ERROR, (event, data) => {
      // hls.js 回调只传一个 data，这里兼容两种签名
      const info = data || event
      if (!info || !info.fatal) return
      const detail = info.details || info.type || '未知错误'

      // 清单加载失败：多为跨域(CORS)、服务器拒绝/限流，或该链接并非真正的 HLS 流
      if (info.type === Hls.ErrorTypes.NETWORK_ERROR &&
        (detail === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          detail === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          detail === Hls.ErrorDetails.MANIFEST_PARSING_ERROR)) {
        setStatus(`加载失败`)
        // 兜底：个别"假 .m3u8"实为可直接播放的流（无需 CORS）
        if (state.hls) {
          state.hls.destroy()
          state.hls = null
        }
        return
      }

      setStatus(`播放失败`)
    })
  } else {
    // 原生支持
    video.src = url
    video.play()
  }

  showNowPlaying(channel) // 视频顶部悬浮显示分组 + 频道
  pendingMediaType = null // 重置类型推断，等待新频道正常播放
  showMediaBadge(null) // 未正常播放前隐藏媒体类型徽标
  addToHistory(channel) // 记录播放历史（最新在前）
  refreshHistorySection(channel) // 局部刷新播放历史分组
  updatePlayingHighlight() // 只更新高亮，不重建卡片，避免 logo 重新加载
}

// ===== 文件导入 =====
async function importFromFile() {
  try {
    const { open } = window.__TAURI__.dialog
    const { readTextFile } = window.__TAURI__.fs

    const selected = await open({
      multiple: false,
      filters: [{
        name: '播放列表',
        extensions: ['m3u', 'm3u8', 'txt']
      }]
    })

    if (!selected) return

    const content = await readTextFile(selected)
    const channels = parseM3U(content)

    if (channels.length === 0) {
      setStatus('暂无数据')
      alert('未找到有效的频道数据，请检查文件格式')
      return
    }

    upsertSource({ type: 'file', source: selected, channels })
    showLatestSource()
  } catch (err) {
    setStatus(`加载失败`)
  }
}

// ===== URL 导入 =====
async function importFromUrl() {
  const url = elements.urlInput.value.trim()
  if (!url) {
    alert('请输入播放列表地址')
    return
  }

  setStatus('正在导入...')
  closeUrlModal()

  try {
    const { fetch } = window.__TAURI__.http

    const response = await fetch(url, {
      method: 'GET',
      connectTimeout: 30000,
    })

    // tauri-plugin-http v2 的 fetch 返回标准 Response 对象，需通过 text() 读取 body
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    const content = await response.text()

    const channels = parseM3U(content)

    if (channels.length === 0) {
      setStatus('暂无数据')
      return
    }

    upsertSource({ type: 'url', source: url, channels })
    showLatestSource()
  } catch (err) {
    setStatus(`导入失败`)
  }
}

function openUrlModal() {
  elements.urlModal.style.display = 'flex'
  elements.urlInput.value = ''
  setTimeout(() => elements.urlInput.focus(), 100)
}

function closeUrlModal() {
  elements.urlModal.style.display = 'none'
}

// ===== 导入历史 =====
// 是否有导入记录正在更新中（更新期间禁用弹窗内所有操作按钮）
let historyBusy = false

// 弹窗内状态提示：text 为空则隐藏；kind ∈ loading | success | error
function setHistoryStatus(text, kind) {
  const el = elements.historyStatus
  if (!text) {
    el.style.display = 'none'
    el.textContent = ''
    el.className = 'history-status'
    return
  }
  el.textContent = text
  el.className = 'history-status ' + (kind || 'loading')
  el.style.display = 'flex'
}

function openHistoryModal() {
  renderHistory()
  // 若弹窗关闭期间仍在更新，重新打开时提示进行中状态
  if (historyBusy) setHistoryStatus('正在更新导入记录...', 'loading')
  elements.historyModal.style.display = 'flex'
}

function closeHistoryModal() {
  elements.historyModal.style.display = 'none'
}

function renderHistory() {
  const list = elements.historyList
  list.innerHTML = ''

  if (state.sources.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>暂无导入记录</p>
        <p class="empty-hint">通过 URL 或文件导入后会在这里显示</p>
      </div>
    `
    return
  }

  const active = latestSource()
  state.sources.forEach(src => {
    const item = document.createElement('div')
    item.className = 'history-item'
    if (active && active.id === src.id) item.classList.add('current')

    const badge = document.createElement('span')
    badge.className = 'history-badge ' + src.type
    badge.textContent = src.type === 'url' ? 'URL' : '文件'

    const displaySource = decodeUrlForDisplay(src.source)
    const sourceText = document.createElement('span')
    sourceText.className = 'history-source'
    sourceText.title = displaySource
    sourceText.textContent = displaySource

    const meta = document.createElement('span')
    meta.className = 'history-meta'
    meta.textContent = `${(src.channels || []).length} 项 · ${formatTime(src.importedAt)}`

    const info = document.createElement('div')
    info.className = 'history-info'
    info.appendChild(badge)
    info.appendChild(sourceText)
    info.appendChild(meta)

    // 更新进行中：禁用弹窗内所有操作按钮
    const busy = historyBusy

    const applyBtn = document.createElement('button')
    applyBtn.className = 'btn btn-sm btn-primary'
    applyBtn.textContent = '应用'
    applyBtn.title = '直接显示本地保存的数据；本地无数据时先获取'
    applyBtn.disabled = busy
    applyBtn.addEventListener('click', () => applySource(src.id))

    const updateBtn = document.createElement('button')
    updateBtn.className = 'btn btn-sm btn-primary'
    updateBtn.textContent = '更新'
    updateBtn.title = '重新获取数据并更新本地后应用'
    updateBtn.disabled = busy
    updateBtn.addEventListener('click', () => refreshSource(src.id))

    const removeBtn = document.createElement('button')
    removeBtn.className = 'btn btn-sm btn-danger'
    removeBtn.textContent = '删除'
    removeBtn.title = '删除该导入记录'
    removeBtn.disabled = busy
    removeBtn.addEventListener('click', () => {
      if (confirm('确定删除该导入记录及其频道吗？')) removeSource(src.id)
    })

    const actions = document.createElement('div')
    actions.className = 'history-actions'
    actions.appendChild(applyBtn)
    actions.appendChild(updateBtn)
    actions.appendChild(removeBtn)

    item.appendChild(info)
    item.appendChild(actions)
    elements.historyList.appendChild(item)
  })
}

// ===== 主题切换 =====
function toggleTheme() {
  const body = document.body
  const currentTheme = body.dataset.theme
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
  body.dataset.theme = newTheme
  elements.themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️'

  // 保存到 localStorage
  localStorage.setItem('iptv-theme', newTheme)
}

function loadTheme() {
  const saved = localStorage.getItem('iptv-theme')
  if (saved) {
    document.body.dataset.theme = saved
    elements.themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️'
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  // 导入按钮
  elements.importFileBtn.addEventListener('click', importFromFile)
  elements.importUrlBtn.addEventListener('click', openUrlModal)

  // 主题切换
  elements.themeToggle.addEventListener('click', toggleTheme)

  // 搜索（全局过滤：匹配的分组强制展开，无匹配的分组隐藏）
  let searchTimer
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.searchKeyword = e.target.value.trim()
      renderGroups()
    }, 300)
  })

  // 分组列表点击委托：分组头展开/收起、频道卡片播放、分页按钮切页
  elements.groupList.addEventListener('click', (e) => {
    const header = e.target.closest('.group-section-header')
    if (header && header.parentElement) {
      toggleGroup(header.parentElement.dataset.group)
      return
    }
    const card = e.target.closest('.channel-card')
    if (card && card._channel) {
      playChannel(card._channel)
      return
    }
    const pageEl = e.target.closest('[data-page]')
    if (pageEl) {
      goToGroupPage(pageEl.dataset.group, Number(pageEl.dataset.page))
    }
  })

  // URL 弹窗
  elements.closeUrlModal.addEventListener('click', closeUrlModal)
  elements.cancelUrlBtn.addEventListener('click', closeUrlModal)
  elements.confirmUrlBtn.addEventListener('click', importFromUrl)
  elements.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') importFromUrl()
  })
  elements.urlModal.addEventListener('click', (e) => {
    if (e.target === elements.urlModal) closeUrlModal()
  })

  // 导入历史
  elements.historyBtn.addEventListener('click', openHistoryModal)
  elements.closeHistoryModal.addEventListener('click', closeHistoryModal)
  elements.closeHistoryBtn.addEventListener('click', closeHistoryModal)
  elements.historyModal.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) closeHistoryModal()
  })

  // 视频结束
  elements.videoPlayer.addEventListener('ended', () => {
    setStatus('播放结束')
  })

  // 视频真正开始播放后才显示直播/视频徽标（播放失败/未播放时保持隐藏）
  elements.videoPlayer.addEventListener('playing', () => {
    if (state.currentChannel) {
      showMediaBadge(state.currentChannel, pendingMediaType)
    }
  })
}

// ===== 初始化 =====
function init() {
  loadTheme()
  bindEvents()
  loadPersistedSources()
  loadPlayHistory()
  showLatestSource()
}

// 启动
init()
