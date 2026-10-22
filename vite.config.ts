/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter means the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Shipped as a single bundle on purpose so the build can be inlined into one file for the hosted demo.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    // Agent worktrees live under .claude/; they are separate checkouts with their own tests.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
});
