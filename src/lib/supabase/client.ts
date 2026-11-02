import type { SupabaseClient } from '@supabase/supabase-js'
import type { EnvironmentResult } from '../config/environment'
import type { Database } from './database.types'

// No fake URL/key fallback. The SDK is loaded only for valid public configuration.
export async function createSupabaseClient(config: EnvironmentResult): Promise<SupabaseClient<Database> | null> {
  if (config.status !== 'configured') return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient<Database>(config.supabaseUrl, config.supabaseKey)
}
