<script setup>
import { useThemeStore } from '../stores/theme'
import { useSourcesStore } from '../stores/sources'

const emit = defineEmits(['import-url', 'open-history'])

const themeStore = useThemeStore()
const sourcesStore = useSourcesStore()

function onFileImport() {
  sourcesStore.importFromFile()
}
</script>

<template>
  <header class="header">
    <div class="header-left"></div>
    <div class="header-right">
      <button class="btn btn-secondary" title="从文件导入" @click="onFileImport">
        文件导入
      </button>
      <button class="btn btn-secondary" title="从URL导入" @click="emit('import-url')">
        URL导入
      </button>
      <button class="btn btn-secondary" title="导入历史" @click="emit('open-history')">
        导入历史
      </button>
      <button class="btn btn-icon" title="切换主题" @click="themeStore.toggle">
        {{ themeStore.theme === 'dark' ? '🌙' : '☀️' }}
      </button>
    </div>
  </header>
</template>
