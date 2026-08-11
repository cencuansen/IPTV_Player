// ===== HLS 加载器：通过 tauri-plugin-http（Rust 后端）请求，绕过浏览器 CORS =====
import { fetch } from '@tauri-apps/plugin-http'
import { BROWSER_UA } from '../utils/http'

export default class TauriHttpLoader {
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

    fetch(context.url, {
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
