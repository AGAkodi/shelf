import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/newsreader/latin-400.css'
import './styles/index.css'
import { LoadingState } from './components/states/LoadingState'
import { ErrorState } from './components/states/ErrorState'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { ServicesContext } from './app/services'
import { SessionProvider } from './features/borrowing/SessionProvider'
import { routes } from './app/routes'
import { validateEnvironment } from './lib/config/environment'
import { createSupabaseClient } from './lib/supabase/client'

const environment = validateEnvironment({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
}, import.meta.env.DEV)
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Shelf root element is missing.')
const root = createRoot(rootElement)
root.render(<LoadingState label="Starting Shelf…" />)

async function start() {
  try {
    const services = { environment, supabase: await createSupabaseClient(environment) }
    const router = createBrowserRouter(routes)
    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <ServicesContext.Provider value={services}>
            <SessionProvider><RouterProvider router={router} /></SessionProvider>
          </ServicesContext.Provider>
        </AppErrorBoundary>
      </StrictMode>,
    )
  } catch {
    root.render(<ErrorState title="Shelf could not start" onRetry={() => window.location.reload()} />)
  }
}

void start()
