<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useBooksStore } from '@/stores/books'

const configStore = useConfigStore()
const booksStore = useBooksStore()

onMounted(async () => {
  await configStore.loadConfig()
  await booksStore.loadBooks()
  await booksStore.loadCategories()
  configStore.applyTheme()
})

watch(
  () => configStore.readingConfig?.theme,
  () => {
    configStore.applyTheme()
  }
)
</script>

<template>
  <div class="app-container" :class="configStore.themeClass">
    <router-view />
  </div>
</template>

<style lang="scss" scoped>
.app-container {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.3s ease;
}
</style>
