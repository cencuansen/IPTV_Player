<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { channelGroups } from '../utils/m3u'

const playerStore = usePlayerStore()
const videoEl = ref(null)

// 视频顶部悬浮显示当前播放信息（来源记录 id / 分组 + 频道名）。
// 优先取播放时写入的独立快照；快照为空（如热更新后旧 store 实例）时回退到
// currentChannel —— 它同样保存在 player store 中，不随频道列表数据源切换而改变
const groupsPath = computed(() => {
  const ch = playerStore.currentChannel
  const id = playerStore.nowPlayingSourceId || ch?.sourceId || ''
  const groups = playerStore.nowPlayingGroups ||
    (ch ? channelGroups(ch).join(' · ') : '')
  if (!groups) return ''
  return id ? `${id}/${groups}` : groups
})

onMounted(() => {
  // 注册 video 元素，供播放与媒体类型推断使用
  playerStore.setVideoElement(videoEl.value)
})
</script>

<template>
  <section class="player-section">
    <!-- 未选择频道时的占位 -->
    <div v-if="!playerStore.currentChannel" class="player-placeholder">
      <div class="placeholder-icon">📺</div>
      <p>选择一个频道开始播放</p>
    </div>

    <!-- 正在播放悬浮信息：视频顶部居中，显示分组 + 频道。
         有当前频道即显示（切换导入历史不清 currentChannel，继续显示正确信息） -->
    <div v-if="playerStore.currentChannel" class="now-playing">
      <span class="now-playing-groups">{{ groupsPath }}</span>
      <span class="now-playing-title" :title="playerStore.currentChannel?.name">
        {{ playerStore.currentChannel?.name }}
      </span>
    </div>

    <video ref="videoEl" class="video-player" :class="{ active: !!playerStore.currentChannel }" controls playsinline
      @playing="playerStore.onVideoPlaying()" @durationchange="playerStore.onVideoDurationChange()"
      @ended="playerStore.onVideoEnded()" @error="playerStore.onVideoError()"></video>
  </section>
</template>
