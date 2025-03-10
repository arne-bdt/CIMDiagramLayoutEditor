import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  
  return {
    plugins: [
      svelte({
        compilerOptions: {
          dev: !isProduction
        }
      })
    ],
    resolve: {
      alias: {
        '@': resolve('./src')
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.svelte']
    },
    esbuild: {
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    base: isProduction ? './' : '/',
    build: {
      outDir: 'dist',
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    optimizeDeps: {
      include: ['svelte', '@asciidoctor/core']
    },
    server: {
      host: true,
      port: 3000
    },
    // Configure the public directory for static assets including docs
    publicDir: 'public'
  };
});