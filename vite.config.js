import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  build: {
    target: 'es2022',
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three/build/three.tsl') || id.includes('three/src/nodes')) {
              return 'three-tsl';
            }
            if (id.includes('three/examples/jsm/tsl/display')) {
              return 'three-postprocess';
            }
            if (id.includes('three/examples/jsm/loaders/RGBELoader')) {
              return 'three-loaders';
            }
            if (id.includes('three')) {
              return 'three-core';
            }
            if (id.includes('lucide')) {
              return 'lucide';
            }
          }
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          if (/\.(hdr|webp|jpg|jpeg|png)$/i.test(name)) {
            return 'assets/media/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
