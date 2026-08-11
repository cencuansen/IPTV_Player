<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useFavoritesStore } from '../stores/favorites'
import { usePlayHistoryStore } from '../stores/playHistory'
import { channelGroups } from '../utils/m3u'
import { getRealLogoUrl, DEFAULT_LOGO } from '../utils/logo'

const props = defineProps({
  channel: { type: Object, required: true },
  showDelete: { type: Boolean, default: false },
})

const playerStore = usePlayerStore()
const favoritesStore = useFavoritesStore()
const playHistoryStore = usePlayHistoryStore()

const groupsText = computed(() => channelGroups(props.channel).join(' · '))
const isPlaying = computed(() =>
  playerStore.currentChannel && props.channel &&
  props.channel.url === playerStore.currentChannel.url)
const isFav = computed(() => favoritesStore.isFavorite(props.channel))

// Logo：始终显示，加载失败时回退到默认占位图
// 若为中转地址，先尝试其真实目标地址；失败再退回原始地址，再失败用默认图
const realLogo = getRealLogoUrl(props.channel.logo || '')
const logoUrl = ref(realLogo || DEFAULT_LOGO)
let logoFallback = 0
function onLogoError() {
  logoFallback++
  if (props.channel.logo && logoFallback === 1 && realLogo !== props.channel.logo) {
    logoUrl.value = props.channel.logo
  } else {
    logoUrl.value = DEFAULT_LOGO
  }
}

function play() {
  playerStore.playChannel(props.channel)
}

function toggleFav() {
  favoritesStore.toggle(props.channel)
}

function removeFromHistory() {
  playHistoryStore.remove(props.channel.url)
}
</script>

<template>
  <div class="channel-card" :class="{ playing: isPlaying }" @click="play">
    <!-- 不发送 Referer：避免 strict-origin-when-cross-origin 提示，也兼容按 Referer 防盗链的 logo 服务器 -->
    <img class="channel-logo" alt="" loading="lazy" referrerpolicy="no-referrer"
      :src="logoUrl" @error="onLogoError" />
    <div class="channel-info">
      <div class="channel-name" :title="channel.name">{{ channel.name }}</div>
      <div class="channel-group">{{ groupsText }}</div>
    </div>
    <!-- 收藏星标：点击切换收藏/取消收藏，不触发播放 -->
    <button type="button" class="channel-star" :class="{ favorited: isFav }"
      :title="isFav ? '取消收藏' : '收藏'" @click.stop="toggleFav">
      {{ isFav ? '★' : '☆' }}
    </button>
    <!-- 播放历史卡片追加单条删除按钮（点击删除，不触发播放） -->
    <button v-if="showDelete" type="button" class="channel-del" title="从播放历史中删除"
      @click.stop="removeFromHistory">✕</button>
  </div>
</template>
