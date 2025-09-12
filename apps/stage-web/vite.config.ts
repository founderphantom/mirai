import { join, resolve } from 'node:path'
import { cwd, env } from 'node:process'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

import { Download } from '@proj-airi/unplugin-fetch/vite'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk/vite'
import { templateCompilerOptions } from '@tresjs/core'
import { LFS, SpaceCard } from 'hfup/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { VueMcp } from 'vite-plugin-vue-mcp'
// import { visualizer } from 'vite-bundle-visualizer' // Will add back when properly configured
import type { Plugin } from 'vite'

// Custom plugin for mobile performance optimizations
function mobileOptimizationPlugin(): Plugin {
  return {
    name: 'mobile-optimization',
    transformIndexHtml(html) {
      // Add critical performance hints
      return html.replace(
        '<head>',
        `<head>
    <!-- Preconnect to critical domains -->
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    
    <!-- Viewport and mobile optimizations -->
    <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes,viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">`
      )
    },
  }
}

export default defineConfig({
  // Build optimizations for mobile performance
  build: {
    target: 'es2020',
    cssTarget: 'chrome80',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Advanced code splitting for optimal mobile loading
        manualChunks: (id) => {
          // Core vendor chunks (always loaded)
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vendor-core'
            }
            
            // UI libraries
            if (id.includes('reka-ui') || id.includes('@formkit/auto-animate')) {
              return 'vendor-ui'
            }
            
            // 3D libraries (lazy loaded)
            if (id.includes('three') || id.includes('@tresjs')) {
              return 'vendor-3d'
            }
            
            // ML/AI libraries (lazy loaded)
            if (id.includes('@huggingface') || id.includes('onnx') || id.includes('transformers')) {
              return 'vendor-ml'
            }
            
            // Audio libraries (lazy loaded)
            if (id.includes('vad-web') || id.includes('unspeech') || id.includes('mediabunny')) {
              return 'vendor-audio'
            }
            
            // API/Network libraries
            if (id.includes('supabase') || id.includes('ofetch')) {
              return 'vendor-api'
            }
            
            // i18n
            if (id.includes('vue-i18n')) {
              return 'vendor-i18n'
            }
            
            // Utils
            if (id.includes('date-fns') || id.includes('nanoid') || id.includes('localforage')) {
              return 'vendor-utils'
            }
          }
        },
        // Production-safe file naming with consistent patterns
        entryFileNames: 'js/[name]-[hash:8].js',
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || 'chunk'
          // Use shorter hash for better caching (8 chars is sufficient)
          return `js/[name]-[hash:8].js`
        },
        assetFileNames: (assetInfo) => {
          // Production-safe handling with proper fallbacks
          const name = assetInfo.name || 'asset'
          
          // Extract extension safely
          const lastDotIndex = name.lastIndexOf('.')
          const ext = lastDotIndex > 0 ? name.slice(lastDotIndex + 1).toLowerCase() : ''
          
          // Organized asset structure for better CDN caching
          if (/^(png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif)$/i.test(ext)) {
            return 'static/images/[name]-[hash:8][extname]'
          }
          
          if (/^(woff2?|ttf|otf|eot)$/i.test(ext)) {
            return 'static/fonts/[name]-[hash:8][extname]'
          }
          
          if (/^(css)$/i.test(ext)) {
            return 'static/css/[name]-[hash:8][extname]'
          }
          
          if (/^(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(ext)) {
            return 'static/media/[name]-[hash:8][extname]'
          }
          
          // Default fallback for all other assets
          return 'static/assets/[name]-[hash:8][extname]'
        },
      },
      // Optimize for tree shaking
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: false,
      },
    },
    // Enable source maps for debugging (disable in production for performance)
    sourcemap: false,
    // Inline assets smaller than 4kb
    assetsInlineLimit: 4096,
  },
  
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      '@vueuse/shared',
    ],
    exclude: [
      // Internal Packages
      '@proj-airi/stage-ui/*',
      '@proj-airi/drizzle-duckdb-wasm',
      '@proj-airi/drizzle-duckdb-wasm/*',

      // Static Assets: Models, Images, etc.
      'public/assets/*',

      // Live2D SDK
      '@framework/live2dcubismframework',
      '@framework/math/cubismmatrix44',
      '@framework/type/csmvector',
      '@framework/math/cubismviewmatrix',
      '@framework/cubismdefaultparameterid',
      '@framework/cubismmodelsettingjson',
      '@framework/effect/cubismbreath',
      '@framework/effect/cubismeyeblink',
      '@framework/model/cubismusermodel',
      '@framework/motion/acubismmotion',
      '@framework/motion/cubismmotionqueuemanager',
      '@framework/type/csmmap',
      '@framework/utils/cubismdebug',
      '@framework/model/cubismmoc',
    ],
    // Force optimization for better initial load
    force: true,
  },

  resolve: {
    alias: {
      '@': resolve(join(import.meta.dirname, 'src')),
      '@proj-airi/stage-ui/components/scenarios/settings/model-settings': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'components', 'Scenarios', 'Settings', 'ModelSettings')),
      '@proj-airi/stage-ui/components/scenes': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'components', 'Scenes')),
      '@proj-airi/stage-ui/stores': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src', 'stores')),
      '@proj-airi/stage-ui': resolve(join(import.meta.dirname, '..', '..', 'packages', 'stage-ui', 'src')),
      '@proj-airi/i18n': resolve(join(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src')),
    },
  },

  plugins: [
    // Mobile performance optimizations
    mobileOptimizationPlugin(),
    
    // Bundle analyzer (only in build with --analyze flag)
    // Temporarily disabled - will re-enable with proper setup
    // process.env.ANALYZE ? visualizer({
    //   open: true,
    //   gzipSize: true,
    //   brotliSize: true,
    //   filename: 'dist/stats.html',
    // }) : null,
    
    Info(),

    Yaml(),

    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
          ...templateCompilerOptions,
        }),
        vueJsx: false,
      },
      betterDefine: false,
    }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: resolve(import.meta.dirname, 'src/typed-router.d.ts'),
      importMode: 'async',
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/antfu/vite-plugin-pwa
    ...(env.TARGET_HUGGINGFACE_SPACE
      ? []
      : [VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'AIRI',
            short_name: 'AIRI',
            icons: [
              {
                purpose: 'maskable',
                sizes: '192x192',
                src: '/maskable_icon_x192.png',
                type: 'image/png',
              },
              {
                purpose: 'maskable',
                sizes: '512x512',
                src: '/maskable_icon_x512.png',
                type: 'image/png',
              },
              {
                src: '/web-app-manifest-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: '/web-app-manifest-512x512.png',
                sizes: '512x512',
                type: 'image/png',
              },
            ],
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
            navigateFallbackDenylist: [
              /^\/docs\//,
              /^\/ui\//,
              /^\/remote-assets\//,
              /^\/api\//,
            ],
          },
        })]),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
    }),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    VueDevTools(),
    VueMcp(),

    DownloadLive2DSDK(),
    Download('https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip', 'hiyori_free_zh.zip', 'assets/live2d/models'),
    Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'assets/live2d/models'),
    Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm', 'AvatarSample_A.vrm', 'assets/vrm/models/AvatarSample-A'),
    Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm', 'AvatarSample_B.vrm', 'assets/vrm/models/AvatarSample-B'),

    // HuggingFace Spaces
    LFS({ root: cwd(), extraGlobs: ['*.vrm', '*.vrma', '*.hdr', '*.cmo3', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.bmp', '*.ttf'] }),
    SpaceCard({
      root: cwd(),
      title: 'AIRI: Virtual Companion',
      emoji: '🧸',
      colorFrom: 'pink',
      colorTo: 'pink',
      sdk: 'static',
      pinned: false,
      license: 'mit',
      models: [
        'onnx-community/whisper-base',
        'onnx-community/silero-vad',
      ],
      short_description: 'AI driven VTuber & Companion, supports Live2D and VRM.',
    }),
  ].filter(Boolean),
})
