import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-viewer': ['pdfjs-dist'],
          'pdf-exporter': ['pdf-lib'],
          'excel-exporter': ['exceljs'],
          'webgl-math': ['gl-matrix', 'rbush', 'earcut'],
        },
      },
    },
  },
});
