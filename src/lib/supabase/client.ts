import type { SupabaseClient } from '@supabase/supabase-js'
import type { EnvironmentResult } from '../config/environment'

// No fake URL/key fallback. The SDK is loaded only for valid public configuration.
export async function createSupabaseClient(config: EnvironmentResult): Promise<SupabaseClient | null> {
  if (config.status !== 'configured') return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(config.supabaseUrl, config.supabaseKey)
}
