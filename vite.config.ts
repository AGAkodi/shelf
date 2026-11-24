import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { validateEnvironment } from './src/lib/config/environment.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const environment = validateEnvironment(loadEnv(mode, process.cwd(), 'VITE_'), command === 'serve')
  if (command === 'build' && environment.status === 'invalid') {
    throw new Error(`Invalid public configuration: ${environment.issues.join(' ')}`)
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true, port: 5173, strictPort: true,
      allowedHosts: process.env.SHELF_PREVIEW_HOST ? [process.env.SHELF_PREVIEW_HOST] : undefined,
      proxy: process.env.SHELF_LOCAL_SUPABASE_PROXY === '1'
        ? Object.fromEntries(['/auth/v1', '/rest/v1', '/storage/v1', '/functions/v1'].map(path => [
          path, { target: 'http://127.0.0.1:55321', changeOrigin: true },
        ]))
        : undefined,
    },
    preview: { host: true, port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/unit/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      clearMocks: true,
    },
  }
})
