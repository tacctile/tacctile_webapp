import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    react({
      // Enable emotion for MUI
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tacctile - Ghost Hunting App',
        short_name: 'Tacctile',
        description: 'Professional ghost hunting evidence analysis and investigation management',
        theme_color: '#19abb5',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        // Enable file handling for media files
        file_handlers: [
          {
            action: '/',
            accept: {
              'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
              'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],
              'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
            }
          }
        ],
        // Enable share target
        share_target: {
          action: '/share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'media',
                accept: ['video/*', 'audio/*', 'image/*']
              }
            ]
          }
        }
      },
      workbox: {
        // Precache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
        // Runtime caching strategies
        runtimeCaching: [
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache Material Symbols
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'material-symbols-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache FFmpeg WASM files
          {
            urlPattern: /^https:\/\/unpkg\.com\/@ffmpeg\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffmpeg-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache API responses with network-first strategy
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache local media files for offline access (blob URLs and object URLs)
          {
            urlPattern: /^blob:.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-media-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          },
          // Cache images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Skip waiting to immediately activate new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Navigation preload for faster page loads
        navigationPreload: true,
        // Clean old caches
        cleanupOutdatedCaches: true
      },
      // Dev options
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@types': path.resolve(__dirname, './src/types'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets')
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    rollupOptions: {
      output: {
        // Aggressive manual chunk splitting for <200KB initial bundle
        manualChunks: (id) => {
          // React core - essential, loaded first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          // React Router - needed for navigation
          if (id.includes('react-router')) {
            return 'react-router';
          }
          // MUI core - split into smaller chunks
          if (id.includes('@mui/material')) {
            // Split MUI by component type
            if (id.includes('/Button') || id.includes('/IconButton')) {
              return 'mui-buttons';
            }
            if (id.includes('/Box') || id.includes('/Typography') || id.includes('/Divider')) {
              return 'mui-layout';
            }
            if (id.includes('/Slider') || id.includes('/Toggle') || id.includes('/Select')) {
              return 'mui-inputs';
            }
            if (id.includes('/Tooltip') || id.includes('/Dialog') || id.includes('/Modal')) {
              return 'mui-overlays';
            }
            return 'mui-core';
          }
          if (id.includes('@mui/system') || id.includes('@emotion')) {
            return 'mui-system';
          }
          // Heavy libraries - load only when needed
          if (id.includes('three') || id.includes('@react-three')) {
            return 'three-vendor';
          }
          if (id.includes('chart.js') || id.includes('chartjs')) {
            return 'charts-vendor';
          }
          if (id.includes('wavesurfer')) {
            return 'wavesurfer';
          }
          if (id.includes('tone') || id.includes('meyda')) {
            return 'audio-analysis';
          }
          if (id.includes('konva') || id.includes('paper') || id.includes('pixi')) {
            return 'canvas-vendor';
          }
          // Firebase/Supabase - auth bundle
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'firebase-vendor';
          }
          if (id.includes('supabase') || id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          // Utilities
          if (id.includes('lodash')) {
            return 'lodash';
          }
          if (id.includes('date-fns')) {
            return 'date-fns';
          }
          // FFmpeg - only load when needed
          if (id.includes('ffmpeg')) {
            return 'ffmpeg-vendor';
          }
          // Sentry - only in production
          if (id.includes('@sentry')) {
            return 'sentry';
          }
          // Stripe - billing
          if (id.includes('stripe')) {
            return 'stripe';
          }
          // IndexedDB/LocalForage - offline storage
          if (id.includes('dexie') || id.includes('localforage') || id.includes('idb')) {
            return 'offline-storage';
          }
          // File handling
          if (id.includes('filepond')) {
            return 'filepond';
          }
          // Map libraries
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'maps';
          }
        },
        assetFileNames: (assetInfo) => {
          // Bundle fonts in a dedicated fonts directory
          if (assetInfo.name && /\.(woff2?|ttf|otf|eot)$/i.test(assetInfo.name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          // Other assets use default naming
          return 'assets/[name]-[hash][extname]';
        },
        // Smaller chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    // Ensure fonts are properly included
    assetsInlineLimit: 4096, // Inline small assets (<4KB)
    chunkSizeWarningLimit: 500, // Warn for chunks >500KB
    reportCompressedSize: true
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false // Prevent charset warnings with font imports
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  preview: {
    port: 4173,
    host: true,
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@emotion/react',
      '@emotion/styled'
    ],
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core']
  }
});
