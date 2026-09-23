import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', include: ['src/app/features/question-bank/**/*.test.ts', 'src/app/services/*.test.ts'] } });
