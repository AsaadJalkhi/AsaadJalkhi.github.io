import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * ASAAD.OS build configuration.
 *
 * `base` defaults to './' so the built site works from ANY location:
 * a user page (asaad.github.io), a project subdirectory
 * (asaad.github.io/asaad-os/) or a custom domain — without edits.
 * Override it with BASE_PATH if you ever need an absolute base.
 */
export default defineConfig(() => ({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        /**
         * Split the big vendors so a content-only change doesn't invalidate
         * them. Matched by path rather than package name: the object form
         * emitted an empty `react` chunk, because the app imports
         * `react/jsx-runtime` and `react-dom/client` rather than the bare
         * package ids. The trailing slash keeps `react-rnd` out of the React
         * chunk.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/gsap')) return 'motion';
          if (/node_modules\/(react-rnd|re-resizable|react-draggable)\//.test(id)) {
            return 'windowing';
          }
          return undefined;
        },
      },
    },
  },
}));
