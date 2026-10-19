/// <reference types="vitest/config" />
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/core',
  server: { port: 3000, host: 'localhost' },
  preview: { port: 4300, host: 'localhost' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  css: { postcss: __dirname },
  build: {
    outDir: '../../dist/apps/core',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
