import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@fonts': path.resolve(__dirname, './src/assets/fonts')
    }
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Bundle fonts in a dedicated fonts directory
          if (assetInfo.name && /\.(woff2?|ttf|otf|eot)$/i.test(assetInfo.name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          // Other assets use default naming
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Ensure fonts are properly included
    assetsInlineLimit: 0 // Don't inline fonts, always copy them
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false // Prevent charset warnings with font imports
      }
    }
  }
});
