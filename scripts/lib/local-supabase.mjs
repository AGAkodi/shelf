import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

export const root = resolve(import.meta.dirname, '../..')
// Docker Desktop per-user installation is not always inherited by a running terminal.
if (process.platform === 'win32') {
  const dirs = [join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin'),
    join(process.env.ProgramFiles ?? 'C:/Program Files', 'Docker/Docker/resources/bin')]
  process.env.PATH = [...dirs.filter((dir) => existsSync(dir)), process.env.PATH].join(';')
}
export function cli(args) {
  return execFileSync(process.execPath, [join(root, 'node_modules/supabase/dist/supabase.js'), ...args],
    { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
}

export function localClients() {
  // Credentials stay in this Node process, never in source, logs or Vite variables.
  const status = JSON.parse(cli(['status', '-o', 'json']))
  const url = status.API_URL
  if (url !== 'http://127.0.0.1:55321' && url !== 'http://localhost:55321') {
    throw new Error('Refusing non-local Supabase target')
  }
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local CLI credentials unavailable')
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  return {
    url, anonKey: status.ANON_KEY,
    anon: createClient(url, status.ANON_KEY, options),
    server: createClient(url, status.SERVICE_ROLE_KEY, options),
    reader: () => createClient(url, status.ANON_KEY, options),
  }
}

export function sql(statement) {
  // Fixed local container/database; deliberately no remote connection option.
  return execFileSync('docker', ['exec', '-i', 'supabase_db_shelf', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 })
}
