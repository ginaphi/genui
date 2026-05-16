import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    target: 'es2022',
    // The OpenUI component library is ~2MB raw / ~600KB gzipped — that IS the
    // shipped surface, not waste (see ADR-0015). Threshold set just above
    // current size so any meaningful regression still surfaces a warning.
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'index[extname]',
      },
    },
  },
})
