import { describe, expect, it } from 'vitest'
import { validateEnvironment } from '../../src/lib/config/environment'
import { createSupabaseClient } from '../../src/lib/supabase/client'

const publicConfig = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
}
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.test-only`

describe('public configuration security boundary', () => {
  it('leaves the shell unconfigured and creates no client when values are missing', async () => {
    const result = validateEnvironment({})
    expect(result.status).toBe('unconfigured')
    expect(await createSupabaseClient(result)).toBeNull()
  })
  it('accepts a public project key and creates a client without making data requests', async () => {
    const result = validateEnvironment(publicConfig)
    expect(result.status).toBe('configured')
    expect(await createSupabaseClient(result)).not.toBeNull()
  })
  it.each(['sb_secret_do_not_expose', jwt('service_role'), 'malformed'])('rejects private or malformed credentials without reflecting their value', async key => {
    const result = validateEnvironment({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: key })
    expect(result.status).toBe('invalid')
    expect(await createSupabaseClient(result)).toBeNull()
    expect(JSON.stringify(result)).not.toContain(key)
  })
  it('supports the legacy public anon credential', () => {
    expect(validateEnvironment({ ...publicConfig, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') }).status).toBe('configured')
  })
  it.each(['javascript:alert(1)', 'http://public.example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?secret=x'])('rejects an unsafe project URL: %s', url => {
    expect(validateEnvironment({ ...publicConfig, VITE_SUPABASE_URL: url }, true).status).toBe('invalid')
  })
  it('allows local HTTP only during development', () => {
    const env = { ...publicConfig, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }
    expect(validateEnvironment(env, true).status).toBe('configured')
    expect(validateEnvironment(env, false).status).toBe('invalid')
  })
  it('rejects invalid application origins even without Supabase settings', () => {
    expect(validateEnvironment({ VITE_APP_URL: 'not-a-url' }).status).toBe('invalid')
  })
})
