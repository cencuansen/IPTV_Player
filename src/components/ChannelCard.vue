<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useFavoritesStore } from '../stores/favorites'
import { usePlayHistoryStore } from '../stores/playHistory'
import { useFailedChannelsStore } from '../stores/failedChannels'
import { channelGroups } from '../utils/m3u'
import { getRealLogoUrl, probeLogo, DEFAULT_LOGO } from '../utils/logo'

const props = defineProps({
  channel: { type: Object, required: true },
  showDelete: { type: Boolean, default: false },
})

const playerStore = usePlayerStore()
const favoritesStore = useFavoritesStore()
const playHistoryStore = usePlayHistoryStore()
const failedChannelsStore = useFailedChannelsStore()

const groupsText = computed(() => channelGroups(props.channel).join(' · '))
const isPlaying = computed(() =>
  playerStore.currentChannel && props.channel &&
  props.channel.url === playerStore.currentChannel.url)
const isFav = computed(() => favoritesStore.isFavorite(props.channel))
// 最近播放失败过的频道：名称以暗红色标识，鼠标悬停提示
const isFailed = computed(() => failedChannelsStore.isFailed(props.channel))
const nameTitle = computed(() => isFailed.value ? `${props.channel.name}（上次播放失败）` : props.channel.name)

// Logo：始终先显示默认占位图，真实 logo 预加载成功后才替换，避免破图/闪烁
// 候选依次为真实目标地址（中转时提取）→ 原始地址；任一加载成功即替换，全部失败保持占位图
// 探测经 probeLogo 模块级缓存去重：同一 URL 会话内只请求一次，组件重建/多卡片引用不再重复请求
const logoUrl = ref(DEFAULT_LOGO)
const realLogo = getRealLogoUrl(props.channel.logo || '')
const logoCandidates = []
if (realLogo) logoCandidates.push(realLogo)
if (props.channel.logo && props.channel.logo !== realLogo) {
  logoCandidates.push(props.channel.logo)
}

async function resolveLogo() {
  for (const url of logoCandidates) {
    if (await probeLogo(url)) { logoUrl.value = url; return }
  }
  // 全部失败：保持默认占位图
}

if (logoCandidates.length) resolveLogo()

// 保险兜底：替换后的真实 logo 若仍渲染失败，回到默认占位图
function onLogoError() {
  logoUrl.value = DEFAULT_LOGO
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
      <div class="channel-name" :class="{ failed: isFailed }" :title="nameTitle">{{ channel.name }}</div>
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
