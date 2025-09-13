import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js'
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs'
      }
    },
    outDir: '.vite/build',
    emptyOutDir: false
  }
});