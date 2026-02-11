import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/',
    server: {
      port: parseInt(env.PORT || '5173'),
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../shared')
      }
    },
    build: {
      outDir: 'dist',
    },
  };
});