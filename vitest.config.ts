/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    // @ts-expect-error - vitest types are not automatically detected in vite config
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        coverage: {
            reporter: ['text', 'json', 'html'],
        },
    },
});
