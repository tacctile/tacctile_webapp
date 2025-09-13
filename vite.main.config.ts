import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // Node.js native modules
        'keytar',
        'serialport',
        'bluetooth-serial-port',
        'usb',
        'node-hid',
        // Other native dependencies
        'sqlite3',
        'better-sqlite3',
        'node-bluetooth',
        'canvas',
        'sharp'
      ]
    }
  }
});
