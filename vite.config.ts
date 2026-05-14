import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/Kana_Shift_Converter/',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'kuromoji-dict-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.includes('/dict/') && req.url.endsWith('.dat.gz')) {
              const originalSetHeader = res.setHeader;
              res.setHeader = function(name: string, value: any) {
                if (name.toLowerCase() === 'content-encoding' && value === 'gzip') {
                  return this;
                }
                return originalSetHeader.call(this, name, value);
              };
            }
            next();
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'path': 'path-browserify',
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
