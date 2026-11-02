import { createContext, useContext } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import type { EnvironmentResult } from '../lib/config/environment'

export interface AppServices {
  environment: EnvironmentResult
  supabase: SupabaseClient<Database> | null
}

export const ServicesContext = createContext<AppServices | null>(null)

export function useServices(): AppServices {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Application services are unavailable.')
  return services
}
