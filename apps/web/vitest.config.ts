import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['hooks/**', 'stores/**', 'lib/**', 'components/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Espelha o transpilePackages do next.config.js: os pacotes do workspace são TS cru.
      '@erp/constants': path.resolve(__dirname, '../../packages/constants/src/index.ts'),
      '@erp/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@erp/validators': path.resolve(__dirname, '../../packages/validators/src/index.ts'),
    },
  },
});
