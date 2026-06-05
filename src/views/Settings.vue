<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useBooksStore } from '@/stores/books'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Back,
  FolderAdd,
  Delete,
  Folder,
  Setting as SettingIcon,
  Reading,
  Monitor,
  Refresh
} from '@element-plus/icons-vue'

const router = useRouter()
const configStore = useConfigStore()
const booksStore = useBooksStore()

const activeTab = ref('reading')
const newCategoryName = ref('')
const isScanning = ref(false)

onMounted(async () => {
  await configStore.loadConfig()
  await booksStore.loadCategories()
})

function goBack() {
  router.push('/')
}

async function addCategory() {
  if (!newCategoryName.value.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  await booksStore.addCategory(newCategoryName.value.trim())
  newCategoryName.value = ''
  ElMessage.success('分类创建成功')
}

async function deleteCategory(id: number, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类"${name}"吗？该分类下的书籍将移至"未分类"。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await booksStore.deleteCategory(id)
    ElMessage.success('删除成功')
  } catch {
    // User cancelled
  }
}

async function addScanPath() {
  const path = await window.electronAPI.file.openFolderDialog()
  if (path) {
    await configStore.addScanPath(path)
    ElMessage.success('扫描路径已添加')
  }
}

async function removeScanPath(path: string) {
  await configStore.removeScanPath(path)
}

async function scanBooks() {
  if (!configStore.appConfig?.scanPaths.length) {
    ElMessage.warning('请先添加扫描路径')
    return
  }

  isScanning.value = true
  try {
    const bookIds = await window.electronAPI.file.scanBooks(configStore.appConfig.scanPaths)
    ElMessage.success(`扫描完成，共找到 ${bookIds.length} 本书籍`)
    await booksStore.loadBooks()
  } finally {
    isScanning.value = false
  }
}

function resetReadingConfig() {
  configStore.updateReadingConfig({
    fontSize: 18,
    lineHeight: 2,
    letterSpacing: 1,
    pageMargin: 40,
    theme: 'light',
    readMode: 'scroll',
    pageChars: 800
  })
  ElMessage.success('阅读设置已重置')
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <div class="header-left">
        <el-button circle :icon="Back" @click="goBack" />
        <h1 class="title">设置</h1>
      </div>
    </header>

    <div class="settings-content">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="阅读设置" name="reading">
          <template #label>
            <el-icon><Reading /></el-icon>
            阅读设置
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>默认阅读配置</h2>
              <el-button size="small" :icon="Refresh" @click="resetReadingConfig">
                重置默认
              </el-button>
            </div>

            <div class="setting-item">
              <label>默认主题</label>
              <el-radio-group
                v-model="configStore.readingConfig!.theme"
                @change="(val) => configStore.updateReadingConfig({ theme: val })"
              >
                <el-radio-button value="light">日间</el-radio-button>
                <el-radio-button value="dark">夜间</el-radio-button>
                <el-radio-button value="eye">护眼</el-radio-button>
              </el-radio-group>
            </div>

            <div class="setting-item">
              <label>默认阅读模式</label>
              <el-radio-group
                v-model="configStore.readingConfig!.readMode"
                @change="(val) => configStore.updateReadingConfig({ readMode: val })"
              >
                <el-radio-button value="scroll">滚动模式</el-radio-button>
                <el-radio-button value="page">翻页模式</el-radio-button>
              </el-radio-group>
            </div>

            <div class="setting-item">
              <label>
                默认字号
                <span class="value">{{ configStore.readingConfig?.fontSize }}px</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.fontSize"
                :min="12"
                :max="48"
                :step="2"
                :marks="{ 12: '12px', 18: '18px', 24: '24px', 36: '36px', 48: '48px' }"
                @change="(val) => configStore.updateReadingConfig({ fontSize: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认行间距
                <span class="value">{{ configStore.readingConfig?.lineHeight.toFixed(1) }}</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.lineHeight"
                :min="1.2"
                :max="4"
                :step="0.2"
                :marks="{ 1.2: '1.2', 2: '2.0', 3: '3.0', 4: '4.0' }"
                @change="(val) => configStore.updateReadingConfig({ lineHeight: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认页边距
                <span class="value">{{ configStore.readingConfig?.pageMargin }}px</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.pageMargin"
                :min="10"
                :max="200"
                :step="10"
                :marks="{ 10: '10px', 40: '40px', 100: '100px', 200: '200px' }"
                @change="(val) => configStore.updateReadingConfig({ pageMargin: val })"
              />
            </div>

            <div class="setting-item">
              <label>
                默认每页字数
                <span class="value">{{ configStore.readingConfig?.pageChars }}</span>
              </label>
              <el-slider
                v-model="configStore.readingConfig!.pageChars"
                :min="200"
                :max="2000"
                :step="100"
                :marks="{ 200: '200', 800: '800', 1400: '1400', 2000: '2000' }"
                @change="(val) => configStore.updateReadingConfig({ pageChars: val })"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="分类管理" name="category">
          <template #label>
            <el-icon><Folder /></el-icon>
            分类管理
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>书籍分类</h2>
            </div>

            <div class="add-category">
              <el-input
                v-model="newCategoryName"
                placeholder="输入新分类名称"
                @keyup.enter="addCategory"
              />
              <el-button type="primary" :icon="FolderAdd" @click="addCategory">
                添加分类
              </el-button>
            </div>

            <div class="category-list">
              <div
                v-for="cat in booksStore.categories"
                :key="cat.id"
                class="category-item"
              >
                <div class="category-info">
                  <el-icon><Folder /></el-icon>
                  <span class="category-name">{{ cat.name }}</span>
                  <span class="category-count">
                    {{ booksStore.books.filter(b => b.categoryId === cat.id).length }} 本
                  </span>
                </div>
                <el-button
                  v-if="cat.name !== '未分类'"
                  circle
                  size="small"
                  type="danger"
                  :icon="Delete"
                  @click="deleteCategory(cat.id, cat.name)"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="扫描设置" name="scan">
          <template #label>
            <el-icon><Monitor /></el-icon>
            扫描设置
          </template>
          <div class="settings-section">
            <div class="section-header">
              <h2>扫描路径</h2>
              <el-button
                type="primary"
                :icon="FolderAdd"
                :loading="isScanning"
                @click="scanBooks"
              >
                立即扫描
              </el-button>
            </div>

            <div class="scan-paths">
              <div v-if="!configStore.appConfig?.scanPaths.length" class="empty-paths">
                <el-icon :size="48"><Folder /></el-icon>
                <p>暂无扫描路径</p>
                <p class="hint">添加路径后会自动扫描该目录下的所有小说文件</p>
              </div>
              <div
                v-for="path in configStore.appConfig?.scanPaths"
                :key="path"
                class="path-item"
              >
                <div class="path-info">
                  <el-icon><Folder /></el-icon>
                  <span class="path-text">{{ path }}</span>
                </div>
                <el-button
                  circle
                  size="small"
                  type="danger"
                  :icon="Delete"
                  @click="removeScanPath(path)"
                />
              </div>
            </div>

            <el-button :icon="FolderAdd" @click="addScanPath">
              添加扫描路径
            </el-button>
          </div>

          <div class="settings-section">
            <div class="section-header">
              <h2>编码设置</h2>
            </div>
            <div class="setting-item">
              <label>自动检测编码</label>
              <el-switch
                v-model="configStore.appConfig!.autoDetectEncoding"
                @change="(val) => configStore.updateAppConfig({ autoDetectEncoding: val })"
              />
            </div>
            <div class="setting-item">
              <label>默认编码</label>
              <el-select
                v-model="configStore.appConfig!.defaultEncoding"
                @change="(val) => configStore.updateAppConfig({ defaultEncoding: val })"
              >
                <el-option label="UTF-8" value="utf-8" />
                <el-option label="GBK" value="gbk" />
                <el-option label="GB2312" value="gb2312" />
                <el-option label="GB18030" value="gb18030" />
                <el-option label="BIG5" value="big5" />
              </el-select>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="关于" name="about">
          <template #label>
            <el-icon><SettingIcon /></el-icon>
            关于
          </template>
          <div class="settings-section about-section">
            <div class="app-logo">📚</div>
            <h2 class="app-name">小说阅读器</h2>
            <p class="app-version">版本 1.0.0</p>
            <p class="app-desc">
              一个简洁、高效的本地小说阅读器，支持 TXT、EPUB 等多种格式。
            </p>
            <div class="tech-stack">
              <h3>技术栈</h3>
              <ul>
                <li>Electron 28+</li>
                <li>Vue 3 + TypeScript</li>
                <li>Vite</li>
                <li>Pinia</li>
                <li>Element Plus</li>
                <li>Better-SQLite3</li>
              </ul>
            </div>
            <div class="features">
              <h3>功能特性</h3>
              <ul>
                <li>📖 支持 TXT、EPUB 格式</li>
                <li>🎨 三种主题（日间/夜间/护眼）</li>
                <li>📑 智能分页，章节识别</li>
                <li>🔖 书签功能</li>
                <li>📊 阅读进度保存</li>
                <li>📁 批量扫描导入</li>
                <li>🏷️ 分类管理</li>
                <li>⌨️ 快捷键支持</li>
              </ul>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.settings-header {
  display: flex;
  align-items: center;
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
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;

  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0;
  }

  :deep(.el-tabs__item) {
    padding: 0 20px;
  }
}

.settings-section {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
    }
  }
}

.setting-item {
  display: flex;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }

  label {
    min-width: 160px;
    font-size: 14px;
    color: var(--text-primary);

    .value {
      color: var(--accent-color);
      margin-left: 8px;
      font-weight: 500;
    }
  }

  :deep(.el-slider) {
    flex: 1;
    max-width: 400px;
  }
}

.add-category {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;

  .el-input {
    flex: 1;
    max-width: 300px;
  }
}

.category-list {
  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 8px;

    .category-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-primary);

      .category-name {
        font-weight: 500;
      }

      .category-count {
        font-size: 12px;
        color: var(--text-tertiary);
      }
    }
  }
}

.scan-paths {
  margin-bottom: 16px;

  .empty-paths {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 16px;

    .hint {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 4px;
    }
  }

  .path-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    margin-bottom: 8px;

    .path-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--text-primary);
      overflow: hidden;

      .path-text {
        font-family: monospace;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

.about-section {
  text-align: center;

  .app-logo {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .app-name {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px;
  }

  .app-version {
    font-size: 14px;
    color: var(--text-tertiary);
    margin: 0 0 16px;
  }

  .app-desc {
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  .tech-stack,
  .features {
    text-align: left;
    margin-bottom: 24px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ul {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;

      li {
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        font-size: 13px;
        color: var(--text-secondary);
      }
    }
  }
}
</style>
