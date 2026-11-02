import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { localClients, root } from './lib/local-supabase.mjs'
const { url, anonKey } = localClients()
const testing = process.argv.includes('--test')
const result = spawnSync(process.execPath, testing
  ? [join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.catalogue.config.ts']
  : [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey },
})
process.exit(result.status ?? 1)
