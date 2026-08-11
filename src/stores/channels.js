import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { channelGroups } from '../utils/m3u'
import { usePlayHistoryStore } from './playHistory'
import { useFavoritesStore } from './favorites'

// 频道列表与分组状态（不持久化：expanded 为 Set 无法序列化，且每次导入都重置）
export const useChannelsStore = defineStore('channels', () => {
  const channels = ref([])
  const expanded = ref(new Set(['全部频道'])) // 已展开的分组
  const groupPages = ref({}) // { 分组名: 页码 }，每组独立分页
  const searchKeyword = ref('')
  const pageSize = ref(10) // 每个分组内每页显示的频道数

  // 搜索前保存的展开状态：开始搜索时折叠全部，清空搜索后恢复
  let preSearchExpanded = null

  // 分组 → 频道映射（按 channelGroups 拆分，一个频道可属于多个分组）
  const groupMap = computed(() => {
    const map = {}
    for (const ch of channels.value) {
      for (const g of channelGroups(ch)) {
        if (!map[g]) map[g] = []
        map[g].push(ch)
      }
    }
    return map
  })

  // 分组列表，按频道数降序
  const groups = computed(() =>
    Object.entries(groupMap.value)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, list]) => ({ name, count: list.length })))

  // 关键词匹配频道名或任一所属分组
  function matchesSearch(ch, keyword) {
    if (!keyword) return true
    const k = keyword.toLowerCase()
    return ch.name.toLowerCase().includes(k) ||
      channelGroups(ch).some(g => g.toLowerCase().includes(k))
  }

  // 获取某分组在当前搜索条件下的频道列表
  // （"全部频道"为所有频道，"播放历史"取历史记录，"已收藏"取收藏列表）
  function getGroupChannels(groupName) {
    let all
    if (groupName === '全部频道') all = channels.value
    else if (groupName === '播放历史') all = usePlayHistoryStore().playHistory
    else if (groupName === '已收藏') all = useFavoritesStore().favorites
    else all = groupMap.value[groupName] || []
    if (!searchKeyword.value) return all
    return all.filter(ch => matchesSearch(ch, searchKeyword.value))
  }

  // 切换数据源（导入/应用/删除后）：赋值频道并重置搜索与展开状态
  function setChannels(list) {
    channels.value = list
    searchKeyword.value = ''
    expanded.value = new Set(['全部频道'])
    groupPages.value = {}
    preSearchExpanded = null
  }

  // 更新搜索关键词：进入搜索时记录并折叠全部展开分组；清空搜索时恢复
  function setSearchKeyword(keyword) {
    const prevKeyword = searchKeyword.value
    searchKeyword.value = keyword
    if (!prevKeyword && keyword) {
      preSearchExpanded = expanded.value
      expanded.value = new Set()
    }
    if (prevKeyword && !keyword) {
      if (preSearchExpanded) expanded.value = preSearchExpanded
      preSearchExpanded = null
    }
  }

  // 展开/收起分组
  function toggleGroup(groupName) {
    if (expanded.value.has(groupName)) expanded.value.delete(groupName)
    else expanded.value.add(groupName)
  }

  // 切换某分组页码
  function goToGroupPage(groupName, page) {
    groupPages.value[groupName] = page
  }

  return {
    channels, expanded, groupPages, searchKeyword, pageSize,
    groupMap, groups,
    matchesSearch, getGroupChannels, setChannels, setSearchKeyword,
    toggleGroup, goToGroupPage,
  }
})
