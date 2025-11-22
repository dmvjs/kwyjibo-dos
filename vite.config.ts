import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@audio': resolve(__dirname, './src/audio'),
      '@core': resolve(__dirname, './src/core'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
  build: {
    target: 'esnext', // Support modern features like top-level await
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
