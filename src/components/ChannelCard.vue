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
  // 是否显示收藏按钮（"播放历史"分组内隐藏，避免与其他分组重复操作）
  showFavorite: { type: Boolean, default: true },
  // 在"播放历史"分组内播放：不把该频道提到历史列表最前
  keepHistoryOrder: { type: Boolean, default: false },
})

const playerStore = usePlayerStore()
const favoritesStore = useFavoritesStore()
const playHistoryStore = usePlayHistoryStore()
const failedChannelsStore = useFailedChannelsStore()

const groupsText = computed(() => channelGroups(props.channel).join(' · '))
// 频道所属的导入记录 id（本次更新前导入的数据由启动迁移补齐，可能为空）
const sourceId = computed(() => props.channel.sourceId || '')
// 路径形式展示：导入记录 id / 频道分组（无来源 id 时仅显示分组）
const pathText = computed(() => sourceId.value ? `${sourceId.value}/${groupsText.value}` : groupsText.value)
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
  playerStore.playChannel(props.channel, { keepHistoryOrder: props.keepHistoryOrder })
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
      <!-- 来源导入记录 id 以路径形式与频道分组一起显示：id/频道分组 -->
      <div class="channel-path" :title="pathText">
        <template v-if="sourceId">
          <span class="channel-source">{{ sourceId }}</span>
          <span class="channel-path-sep">/</span>
        </template>
        <span class="channel-group">{{ groupsText }}</span>
      </div>
    </div>
    <!-- 收藏星标：点击切换收藏/取消收藏，不触发播放 -->
    <button v-if="showFavorite" type="button" class="channel-star" :class="{ favorited: isFav }"
      :title="isFav ? '取消收藏' : '收藏'" @click.stop="toggleFav">
      {{ isFav ? '★' : '☆' }}
    </button>
    <!-- 播放历史卡片追加单条删除按钮（点击删除，不触发播放） -->
    <button v-if="showDelete" type="button" class="channel-del" title="从播放历史中删除"
      @click.stop="removeFromHistory">✕</button>
  </div>
</template>
