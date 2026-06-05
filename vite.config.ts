import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

export default defineConfig({
  optimizeDeps: {
    exclude: ['better-sqlite3', 'epubjs']
  },
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            sourcemap: true,
            rollupOptions: {
              external: ['better-sqlite3', 'iconv-lite', 'jschardet', 'epubjs']
            }
          }
        }
      },
      preload: {
        input: {
          index: 'electron/preload/index.ts'
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            sourcemap: true
          }
        }
      },
      renderer: {}
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'electron/main'),
      '@preload': resolve(__dirname, 'electron/preload')
    }
  },
  server: {
    port: 7777,
    strictPort: false,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
})
