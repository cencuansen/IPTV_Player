// ===== 频道 Logo 处理 =====

// 中转地址（如 https://mirror.ghproxy.com/https://raw.githubusercontent.com/...）时，
// 取其路径中的真实目标地址；非中转地址原样返回
export function getRealLogoUrl(url) {
  const m = /^https?:\/\/[^/]+\/(https?:\/\/.+)$/i.exec(String(url))
  return m ? m[1] : url
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
