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
    server: { host: true, port: 5173, strictPort: true },
    preview: { host: true, port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/unit/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      clearMocks: true,
    },
  }
})
