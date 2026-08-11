// ===== M3U 解析器 =====
export function parseM3U(content) {
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
export function splitGroups(raw) {
  return String(raw).split(/[,;|，；]/).map(g => g.trim()).filter(Boolean)
}

// 返回频道所属的所有分组（新数据用 groups 数组；旧本地数据只有 group 字符串，也按相同规则拆分）
export function channelGroups(ch) {
  if (Array.isArray(ch.groups) && ch.groups.length) return ch.groups
  const split = splitGroups(ch.group || '未分组')
  return split.length ? split : ['未分组']
}
