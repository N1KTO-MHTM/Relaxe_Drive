import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '1.2.0'),
  },
  base: './', // relative paths so Electron loadFile() finds JS/CSS
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5174 },
});
