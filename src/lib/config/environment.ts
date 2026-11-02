export interface PublicEnvironment {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  VITE_APP_URL?: string
}

export type EnvironmentResult =
  | { status: 'configured'; supabaseUrl: string; supabaseKey: string; appOrigin?: string }
  | { status: 'unconfigured' | 'invalid'; issues: string[] }

function parseOrigin(value: string, allowLocalHttp: boolean): string | null {
  try {
    const url = new URL(value)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' || /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    if (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:')) return null
    return url.origin
  } catch {
    return null
  }
}

// This only rejects misconfigured public credentials; server authorization must use verified JWTs/RLS.
function isPublicKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true
  try {
    const parts = key.split('.')
    if (parts.length !== 3) return false
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload === 'object' && payload !== null && 'role' in payload && payload.role === 'anon'
  } catch {
    return false
  }
}

export function validateEnvironment(env: PublicEnvironment, development = false): EnvironmentResult {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const appUrl = env.VITE_APP_URL?.trim() ?? ''
  const issues: string[] = []
  let invalid = false
  const supabaseUrl = url ? parseOrigin(url, development) : null
  const appOrigin = appUrl ? parseOrigin(appUrl, development) : undefined

  if (!url) issues.push('VITE_SUPABASE_URL is missing.')
  else if (!supabaseUrl) { issues.push('VITE_SUPABASE_URL must be a secure project origin (local HTTP is development-only).'); invalid = true }
  if (!key) issues.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing.')
  else if (!isPublicKey(key)) { issues.push('Use a Supabase publishable key or legacy anon key; secret and service-role keys are forbidden.'); invalid = true }
  if (appOrigin === null) { issues.push('VITE_APP_URL must be a secure application origin (local HTTP is development-only).'); invalid = true }

  if (issues.length) return { status: invalid ? 'invalid' : 'unconfigured', issues }
  return { status: 'configured', supabaseUrl: supabaseUrl!, supabaseKey: key, appOrigin: appOrigin ?? undefined }
}
