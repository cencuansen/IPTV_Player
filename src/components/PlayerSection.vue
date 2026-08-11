<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { channelGroups } from '../utils/m3u'

const playerStore = usePlayerStore()
const videoEl = ref(null)

const currentChannel = computed(() => playerStore.currentChannel)
// 视频顶部悬浮显示当前播放信息（分组 + 频道名）
const groupsText = computed(() =>
  currentChannel.value ? channelGroups(currentChannel.value).join(' · ') : '')

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

    <!-- 正在播放悬浮信息：视频顶部居中，显示分组 + 频道 -->
    <div v-if="playerStore.nowPlayingVisible" class="now-playing">
      <span class="now-playing-groups">{{ groupsText }}</span>
      <span class="now-playing-title" :title="playerStore.currentChannel?.name">
        {{ playerStore.currentChannel?.name }}
      </span>
    </div>

    <video ref="videoEl" class="video-player" :class="{ active: !!playerStore.currentChannel }" controls playsinline
      @playing="playerStore.onVideoPlaying()" @durationchange="playerStore.onVideoDurationChange()"
      @ended="playerStore.onVideoEnded()"></video>
  </section>
</template>
