<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { ElMessage } from 'element-plus'
import {
  Back,
  Folder,
  FolderOpened,
  ArrowUp,
  Plus,
  Refresh,
  Document,
  Select,
  Star,
  Search
} from '@element-plus/icons-vue'
import type { FileInfo } from '@/types'

const router = useRouter()
const booksStore = useBooksStore()

const currentPath = ref('')
const files = ref<FileInfo[]>([])
const selectedFiles = ref<Set<string>>(new Set())
const isLoading = ref(false)
const showHidden = ref(false)
const systemInfo = ref<{ homedir: string } | null>(null)

const homeDir = computed(() => {
  return systemInfo.value?.homedir || '/'
})

const displayFiles = computed(() => {
  if (showHidden.value) return files.value
  return files.value.filter(f => !f.name.startsWith('.'))
})

const selectedCount = computed(() => selectedFiles.value.size)

const supportedExtensions = ['txt', 'epub', 'pdf', 'chm']

onMounted(async () => {
  systemInfo.value = await window.electronAPI.app.getSystemInfo()
  currentPath.value = homeDir.value
  await loadDirectory(currentPath.value)
})

async function loadDirectory(path: string) {
  isLoading.value = true
  try {
    files.value = await window.electronAPI.file.listDirectory(path)
    currentPath.value = path
    selectedFiles.value.clear()
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push('/')
}

async function goUp() {
  if (currentPath.value === '/') return
  const parent = currentPath.value.substring(0, currentPath.value.lastIndexOf('/'))
  await loadDirectory(parent || '/')
}

async function goHome() {
  await loadDirectory(homeDir.value)
}

async function handleFileClick(file: FileInfo) {
  if (file.isDirectory) {
    await loadDirectory(file.path)
  }
}

function toggleSelect(file: FileInfo) {
  if (file.isDirectory) return
  if (!supportedExtensions.includes(file.extension)) {
    ElMessage.warning('不支持的文件格式')
    return
  }

  if (selectedFiles.value.has(file.path)) {
    selectedFiles.value.delete(file.path)
  } else {
    selectedFiles.value.add(file.path)
  }
}

function isSelected(file: FileInfo): boolean {
  return selectedFiles.value.has(file.path)
}

async function importSelected() {
  if (selectedFiles.value.size === 0) {
    ElMessage.warning('请先选择要导入的文件')
    return
  }

  isLoading.value = true
  try {
    const ids = await booksStore.addBooks(Array.from(selectedFiles.value))
    ElMessage.success(`成功导入 ${ids.length} 本书籍`)
    selectedFiles.value.clear()
  } finally {
    isLoading.value = false
  }
}

function getFileIcon(file: FileInfo): string {
  if (file.isDirectory) return '📁'
  const icons: Record<string, string> = {
    txt: '📄',
    epub: '📖',
    pdf: '📕',
    chm: '📚'
  }
  return icons[file.extension] || '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files) return

  const paths: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = (file as any).path
    if (path) {
      const ext = path.split('.').pop()?.toLowerCase()
      if (ext && supportedExtensions.includes(ext)) {
        paths.push(path)
      }
    }
  }

  if (paths.length > 0) {
    isLoading.value = true
    try {
      const ids = await booksStore.addBooks(paths)
      ElMessage.success(`成功导入 ${ids.length} 本书籍`)
    } finally {
      isLoading.value = false
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}
</script>

<template>
  <div
    class="explorer-page"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <header class="explorer-header">
      <div class="header-left">
        <el-button circle :icon="Back" @click="goBack" />
        <h1 class="title">文件浏览</h1>
      </div>

      <div class="header-center">
        <div class="path-nav">
          <el-button circle size="small" :icon="ArrowUp" @click="goUp" />
          <el-button circle size="small" :icon="FolderOpened" @click="goHome" />
          <el-button circle size="small" :icon="Refresh" @click="loadDirectory(currentPath)" />
          <el-input
            class="path-input"
            :model-value="currentPath"
            readonly
          />
        </div>
      </div>

      <div class="header-right">
        <el-checkbox v-model="showHidden">显示隐藏</el-checkbox>
        <el-button
          type="primary"
          :icon="Plus"
          :disabled="selectedCount === 0"
          @click="importSelected"
        >
          导入选中 ({{ selectedCount }})
        </el-button>
      </div>
    </header>

    <div class="explorer-content" v-loading="isLoading">
      <div v-if="selectedCount > 0" class="selection-bar">
        <span>已选择 {{ selectedCount }} 个文件</span>
        <el-button size="small" type="primary" @click="importSelected">
          导入到书架
        </el-button>
        <el-button size="small" @click="selectedFiles.clear()">
          取消选择
        </el-button>
      </div>

      <div class="drop-hint" v-if="files.length === 0">
        <el-icon :size="64"><Folder /></el-icon>
        <h3>拖拽文件到此处导入</h3>
        <p>支持 TXT、EPUB、PDF、CHM 格式</p>
      </div>

      <div v-else class="file-list">
        <div class="file-header">
          <div class="col-select">
            <el-icon><Select /></el-icon>
          </div>
          <div class="col-name">名称</div>
          <div class="col-size">大小</div>
          <div class="col-type">类型</div>
          <div class="col-date">修改日期</div>
        </div>

        <div
          v-for="file in displayFiles"
          :key="file.path"
          class="file-item"
          :class="{
            selected: isSelected(file),
            'not-supported': !file.isDirectory && !supportedExtensions.includes(file.extension)
          }"
          @dblclick="handleFileClick(file)"
        >
          <div class="col-select" @click.stop>
            <el-checkbox
              v-if="!file.isDirectory && supportedExtensions.includes(file.extension)"
              :model-value="isSelected(file)"
              @change="toggleSelect(file)"
            />
          </div>
          <div class="col-name" @click.stop="handleFileClick(file)">
            <span class="file-icon">{{ getFileIcon(file) }}</span>
            <span class="file-name">{{ file.name }}</span>
          </div>
          <div class="col-size">{{ file.isDirectory ? '-' : formatSize(file.size) }}</div>
          <div class="col-type">
            {{ file.isDirectory ? '文件夹' : file.extension.toUpperCase() }}
          </div>
          <div class="col-date">{{ formatDate(file.updatedAt) }}</div>
        </div>
      </div>
    </div>

    <div class="explorer-footer">
      <span>共 {{ displayFiles.length }} 个项目</span>
      <span class="drag-hint-text">💡 可直接拖拽文件到窗口导入</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.explorer-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.explorer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
    }
  }

  .header-center {
    flex: 1;
    max-width: 600px;
    margin: 0 24px;

    .path-nav {
      display: flex;
      align-items: center;
      gap: 8px;

      .path-input {
        flex: 1;

        :deep(.el-input__wrapper) {
          background: var(--bg-secondary);
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.explorer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  position: relative;

  .selection-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--accent-color);
    color: white;
    border-radius: 8px;
    margin-bottom: 16px;

    span {
      flex: 1;
      font-weight: 500;
    }
  }

  .drop-hint {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);

    h3 {
      font-size: 18px;
      color: var(--text-primary);
      margin: 16px 0 8px;
    }

    p {
      margin: 0;
    }
  }

  .file-list {
    background: var(--bg-primary);
    border-radius: 8px;
    overflow: hidden;

    .file-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: var(--bg-secondary);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .file-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      transition: all 0.2s;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: var(--bg-secondary);
      }

      &.selected {
        background: rgba(64, 158, 255, 0.1);
      }

      &.not-supported {
        opacity: 0.5;
      }

      .col-select {
        width: 40px;
        display: flex;
        align-items: center;
      }

      .col-name {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-primary);
        overflow: hidden;

        .file-icon {
          font-size: 20px;
        }

        .file-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .col-size,
      .col-type,
      .col-date {
        width: 150px;
        font-size: 13px;
        color: var(--text-secondary);
      }

      .col-size {
        text-align: right;
        font-family: monospace;
      }
    }
  }
}

.explorer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);

  .drag-hint-text {
    color: var(--accent-color);
  }
}
</style>
