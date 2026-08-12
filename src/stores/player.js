import { ref } from 'vue'
import { defineStore } from 'pinia'
import Hls from 'hls.js'
import TauriHttpLoader from '../player/TauriHttpLoader'
import { getMediaType, determineHlsType, isDefinitiveHlsType, runtimeMediaType } from '../utils/mediaType'
import { usePlayHistoryStore } from './playHistory'
import { useFailedChannelsStore } from './failedChannels'

// 播放状态：当前频道 + HLS 生命周期 + 媒体类型徽标推断（不持久化）
export const usePlayerStore = defineStore('player', () => {
  const currentChannel = ref(null)

  // 状态提示（原 setStatus 为 no-op，保留语义但不渲染）
  const status = ref('')

  // now-playing 悬浮信息可见性：必须与 currentChannel 解耦——
  // 数据切换（导入/删除）时只隐藏悬浮层，不清当前频道（视频继续播）
  const nowPlayingVisible = ref(false)

  // 媒体类型徽标（右上角 直播/视频）
  const badgeVisible = ref(false)
  const badgeText = ref('')
  const badgeIsLive = ref(false)

  // 媒体类型推断三件套——每次换台必须重置
  // .m3u8 清单加载后推断出的媒体类型；正常播放（video playing）后才用于显示徽标。
  // 播放前保持 null，确保未正常播放时徽标不显示。
  let pendingMediaType = null
  let mediaTypeManifest = null // 上一次清单的媒体序列号，用于滑动窗口（直播）检测
  let mediaTypeSettled = false // 是否已得到确定性结论（VOD 后不再变化）

  // hls 实例与 video 元素均为非响应式（避免 Vue proxy 包裹 Hls 实例 / DOM 元素）
  let hls = null
  let videoEl = null

  // 由 PlayerSection 挂载后注册 video 元素
  function setVideoElement(el) {
    videoEl = el
  }

  function setStatus(text) {
    status.value = text
  }

  function destroyHls() {
    if (hls) {
      hls.destroy()
      hls = null
    }
  }

  // 记录当前频道播放失败（持久化）：清单加载失败、致命解码错误、原生流加载失败等
  function markPlaybackFailed() {
    if (currentChannel.value) useFailedChannelsStore().markFailed(currentChannel.value)
  }

  // 视频顶部悬浮显示当前播放信息；无频道时隐藏（不清 currentChannel）
  function showNowPlaying(channel) {
    nowPlayingVisible.value = !!channel
  }

  // 视频区域顶部右侧显示媒体类型徽标；无频道时隐藏。forcedType 用于 .m3u8
  // 在清单加载后覆盖初始判断（初始按 URL 推断为直播，再按片段时间纠正）。
  function showMediaBadge(channel, forcedType) {
    if (!channel) {
      badgeVisible.value = false
      return
    }
    const type = forcedType || getMediaType(channel.url)
    badgeText.value = type
    badgeIsLive.value = type === '直播'
    badgeVisible.value = true
  }

  function resetMediaType() {
    pendingMediaType = null
    mediaTypeManifest = null
    mediaTypeSettled = false
  }

  function playChannel(channel) {
    currentChannel.value = channel
    destroyHls() // 销毁之前的 HLS 实例

    const el = videoEl
    const url = channel.url

    // 检查是否是 HLS 流
    if (url.includes('.m3u') && Hls.isSupported()) {
      // 使用自定义加载器：经 Rust 后端请求，绕过浏览器 CORS
      const instance = new Hls({ loader: TauriHttpLoader })
      hls = instance
      // 直播/视频类型推断：每次清单加载都重新计算。滑动窗口出现（媒体序列号前移）
      // 即可确认是直播；出现 ENDLIST / VOD 类型声明后不再变化。
      // 只记录到 pendingMediaType，待视频真正开始播放（playing）后才显示徽标；
      // 若徽标已显示（播放中），类型进一步确认后直接刷新。
      // hls.js 的 on() 回调只接收一个 data 参数，(event, data) 中 data 为 undefined，
      // 故用 data || event 兼容取到清单详情，避免推断失效。
      instance.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        const info = data || event
        if (mediaTypeSettled || !info || !info.details) return
        const details = info.details
        pendingMediaType = determineHlsType(details, mediaTypeManifest)
        mediaTypeManifest = { startSN: details.startSN, endSN: details.endSN }
        if (isDefinitiveHlsType(details)) mediaTypeSettled = true
        // 播放中已显示徽标时，若类型被进一步确认（如滑动窗口判定为直播），直接刷新
        if (currentChannel.value && badgeVisible.value) {
          showMediaBadge(currentChannel.value, pendingMediaType)
        }
      })
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        el.play().catch(() => {
          destroyHls()
          markPlaybackFailed()
        })
      })
      instance.on(Hls.Events.ERROR, (event, data) => {
        // hls.js 回调只传一个 data，这里兼容两种签名
        const info = data || event
        if (!info || !info.fatal) return
        const detail = info.details || info.type || '未知错误'

        // 清单加载失败：多为跨域(CORS)、服务器拒绝/限流，或该链接并非真正的 HLS 流
        if (info.type === Hls.ErrorTypes.NETWORK_ERROR &&
          (detail === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            detail === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            detail === Hls.ErrorDetails.MANIFEST_PARSING_ERROR)) {
          setStatus('加载失败')
          markPlaybackFailed()
          // 兜底：个别"假 .m3u8"实为可直接播放的流（无需 CORS）
          destroyHls()
          return
        }

        setStatus('播放失败')
        markPlaybackFailed()
      })
      instance.loadSource(url)
      instance.attachMedia(el)
    } else {
      // 原生支持
      el.src = url
      el.play().catch(() => markPlaybackFailed())
    }

    showNowPlaying(channel) // 视频顶部悬浮显示分组 + 频道
    resetMediaType() // 重置类型推断，等待新频道正常播放
    showMediaBadge(null) // 未正常播放前隐藏媒体类型徽标
    usePlayHistoryStore().add(channel) // 记录播放历史（最新在前）
  }

  // 视频真正开始播放后才显示直播/视频徽标（播放失败/未播放时保持隐藏）。
  // 以实际时长（duration）为准：有限时长 → 视频（有进度条），Infinity → 直播（无进度条）
  function onVideoPlaying() {
    if (!currentChannel.value) return
    // 成功播放即清除持久化失败标记（自愈）：同一频道恢复可用后不再标红
    useFailedChannelsStore().markPlayed(currentChannel.value)
    const t = runtimeMediaType(videoEl)
    if (t) pendingMediaType = t // 运行时信号优先于清单启发式推断
    showMediaBadge(currentChannel.value, pendingMediaType)
  }

  // 原生流 / 已附加媒体的解码错误：同样记录持久化失败（hls.js 自有错误处理已单独标记）
  function onVideoError() {
    markPlaybackFailed()
  }

  // 时长变化（直播为 Infinity / 点播为有限值）时校正徽标：
  // 播放中若媒体类型与当前徽标不符，直接刷新（无需等下一次 playing）
  function onVideoDurationChange() {
    const t = runtimeMediaType(videoEl)
    if (!t || !currentChannel.value) return
    pendingMediaType = t
    if (badgeVisible.value) {
      showMediaBadge(currentChannel.value, pendingMediaType)
    }
  }

  function onVideoEnded() {
    setStatus('播放结束')
  }

  return {
    currentChannel, status, nowPlayingVisible,
    badgeVisible, badgeText, badgeIsLive,
    setVideoElement, setStatus, playChannel,
    onVideoPlaying, onVideoDurationChange, onVideoEnded, onVideoError,
    showNowPlaying, showMediaBadge, resetMediaType,
  }
})
