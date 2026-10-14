import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE (security fix 2026-10-07): The old `define` block that inlined
// GEMINI_API_KEY / MY_GEMINI_API_KEY into the frontend bundle was removed.
// API keys must NEVER ship to the browser. Frontend code now calls the
// backend proxy at /api/gemini-generate (see services/geminiService.ts),
// and only server.ts reads the keys from real environment variables.
export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
