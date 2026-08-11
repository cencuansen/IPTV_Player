// ===== 媒体类型判断（直播 / 视频）=====

// 媒体类型判断（仅按 URL）：明确的点播视频扩展名 → 视频；其余 → 直播。
// 注意：.m3u8 可能是直播也可能是点播，最终需等清单加载后按片段时间重判。
export function getMediaType(url) {
  const path = String(url || '').split(/[?#]/)[0].toLowerCase()
  const m = /\.([a-z0-9]{2,5})$/.exec(path)
  const ext = m ? m[1] : ''
  const VIDEO_EXTS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'mpg', 'mpeg', '3gp']
  return VIDEO_EXTS.includes(ext) ? '视频' : '直播'
}

// 按 hls.js 解析出的清单信息推断直播/视频。
// 信号优先级：
//  1) 清单带 #EXT-X-ENDLIST（details.live === false）或声明 PLAYLIST-TYPE:VOD → 视频（确定）
//  2) 滑动窗口：连续两次清单媒体序列号（startSN/endSN）不同 → 直播（确定，需两次加载）
//  3) 多数片段带 #EXT-X-PROGRAM-DATE-TIME（DVR/直播按墙上时间同步）→ 直播
//  4) 时长兜底：总时长 ≥ 10 分钟且平均切片 ≥ 2 分钟（整部电影/整集拆成少量大切片）→ 视频；其余 → 直播
// prevManifest 记录上一次清单的关键信息，用于滑动窗口检测
export function determineHlsType(details, prevManifest) {
  if (!details) return '直播'

  // ① 明确的 VOD 信号：ENDLIST 或声明 VOD 类型
  if (details.live === false || details.type === 'VOD') return '视频'

  // ② 滑动窗口：媒体序列号前移 → 清单在持续更新，是直播
  if (prevManifest &&
    typeof details.startSN === 'number' &&
    typeof prevManifest.startSN === 'number' &&
    (details.startSN !== prevManifest.startSN ||
      (typeof details.endSN === 'number' &&
        typeof prevManifest.endSN === 'number' &&
        details.endSN !== prevManifest.endSN))) {
    return '直播'
  }

  const fragments = details.fragments || []

  // ③ 多数片段带 PROGRAM-DATE-TIME（DVR/直播常见，VOD 通常只有首片段有或无）
  if (fragments.length) {
    let pdt = 0
    for (const f of fragments) {
      if (f && f.programDateTime !== undefined && f.programDateTime !== null) pdt++
    }
    if (pdt / fragments.length > 0.5) return '直播'
  }

  // ④ 时长兜底：整段时长 + 平均切片都大 → 更像整部/整集点播
  if (fragments.length) {
    const total = details.totalduration ||
      fragments.reduce((s, f) => s + (f.duration || 0), 0)
    const avg = total / fragments.length
    if (total >= 600 && avg >= 120) return '视频'
  }

  // 其余情况（通常为几秒切片、无 ENDLIST）→ 直播
  return '直播'
}

// 是否已能仅凭当前清单给出确定性结论（后续类型不再变化）
export function isDefinitiveHlsType(details) {
  return !!details && (details.live === false || details.type === 'VOD')
}

// 依据视频元素实际时长判断直播/视频（运行时最可靠的信号）：
// 直播流的 media.duration 为 Infinity，原生控件不显示进度条（可拖动）；
// 点播（VOD）时长有限，会显示进度条。据此可将 UI 表现直接映射为类型。
export function runtimeMediaType(videoEl) {
  const d = videoEl.duration
  if (Number.isFinite(d)) return '视频'
  if (d === Infinity) return '直播'
  return null // NaN / 尚未就绪
}
