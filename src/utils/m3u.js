// ===== M3U 解析器 =====
// 兼容标准 M3U/M3U8 与常见 TXT 播放列表（扩展名不代表内容格式）：
//  - 标准写法：#EXTM3U + #EXTINF: 属性行 + 下一行频道地址
//  - #EXTGRP:分组 指定后续频道的分组
//  - TXT 分类行：如 "央视,#genre#"
//  - TXT 条目行：如 "CCTV1,http://example.com/a.m3u8"（多个备用地址用 # 分隔，取第一个）
export function parseM3U(content) {
  const lines = String(content || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const channels = []
  let currentChannel = null
  // TXT 分类 / #EXTGRP 指定的分组，供后续条目使用
  let currentGroup = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // TXT 分类标记（如 "央视,#genre#"）
    const genre = /^(.*?)\s*[,，]\s*#genre#\s*$/i.exec(line)
    if (genre) {
      currentGroup = genre[1].trim()
      continue
    }

    // 独立分组行 #EXTGRP:分组
    if (/^#EXTGRP\s*:/i.test(line)) {
      currentGroup = line.slice(line.indexOf(':') + 1).trim()
      continue
    }

    if (/^#EXTINF\s*:/i.test(line)) {
      // 解析 EXTINF 行
      const info = line.slice(line.indexOf(':') + 1)
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
      // 未声明 group-title 时沿用前面的分类（TXT 列表常见）
      const rawGroup = attrs['group-title'] || currentGroup || '未分组'
      const groups = splitGroups(rawGroup)

      currentChannel = {
        name: name,
        logo: attrs['tvg-logo'] || '',
        groups: groups.length ? groups : ['未分组'],
        group: groups[0] || '未分组', // 主分组（用于卡片展示，兼容旧数据）
        url: '',
      }
    } else if (line.startsWith('#')) {
      // 其他标记行（#EXTM3U、#EXTVLCOPT 等）忽略
      continue
    } else if (currentChannel) {
      // 标准 M3U：上一条 #EXTINF 之后的行是频道地址
      currentChannel.url = line
      channels.push(currentChannel)
      currentChannel = null
    } else {
      // TXT 列表：名称,地址（单行条目，无 #EXTINF）
      const ch = parseTxtEntry(line, currentGroup)
      if (ch) channels.push(ch)
    }
  }

  return channels
}

// 流地址（协议 + 直到空白），用于识别 TXT 单行条目中的地址部分
const STREAM_URL_RE = /(?:https?|rtsp|rtmps?|rtp|udp|mms|p3p|file):\/\/\S+/i

// 解析 TXT 单行条目："频道名,http://..." / "频道名|rtsp://..."。
// 裸地址行（行首即地址、无频道名）不作为频道，避免误收垃圾行。
function parseTxtEntry(line, currentGroup) {
  const m = STREAM_URL_RE.exec(line)
  if (!m || m.index === 0) return null

  const name = line.slice(0, m.index).replace(/[,，|]\s*$/, '').trim()
  // 同一频道可能有多个源，常用 # 分隔，取第一个
  const url = m[0].split('#')[0].trim()
  if (!url) return null

  const group = currentGroup || '未分组'
  return {
    name: name || '未知频道',
    logo: '',
    groups: [group],
    group,
    url,
  }
}

// 按多种分隔符拆分分组字符串（半角/全角逗号、分号、竖线）
export function splitGroups(raw) {
  return String(raw).split(/[,;|，；]/).map(g => g.trim()).filter(Boolean)
}

// 返回频道所属的所有分组（新数据用 groups 数组；旧本地数据只有 group 字符串，也按相同规则拆分）
export function channelGroups(ch) {
  if (Array.isArray(ch.groups) && ch.groups.length) return ch.groups
  const split = splitGroups(ch.group || '未分组')
  return split.length ? split : ['未分组']
}

// ===== M3U 序列化器 =====
// 将频道列表序列化为 m3u/m3u8 文本（保留 tvg-logo 与 group-title，便于重新导入）
export function buildM3U(channels) {
  const lines = ['#EXTM3U']
  for (const ch of channels) {
    if (!ch || !ch.url) continue
    const attrs = []
    if (ch.logo) attrs.push(`tvg-logo="${escapeAttr(ch.logo)}"`)
    attrs.push(`group-title="${escapeAttr(channelGroups(ch).join(','))}"`)
    const name = (ch.name || '未知频道').replace(/[\r\n]+/g, ' ').trim()
    lines.push(`#EXTINF:-1 ${attrs.join(' ')},${name}`)
    lines.push(ch.url)
  }
  return lines.join('\n')
}

// m3u 属性值不允许包含引号（解析时按 " 切分），这里替换为单引号
function escapeAttr(v) {
  return String(v).replace(/"/g, "'")
}
