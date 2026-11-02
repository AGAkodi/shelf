import { BookOpen, ChevronRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useMatches, useNavigation } from 'react-router'
import { LoadingState } from '../states/LoadingState'
import { navigation } from '../../app/navigation'
import { useServices } from '../../app/services'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { environment } = useServices()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const matches = useMatches()
  const pendingNavigation = useNavigation()
  const current = matches.at(-1)?.handle as { title?: string } | undefined
  const title = current?.title ?? 'Shelf'

  useEffect(() => {
    document.title = `${title} · Shelf`
    mainRef.current?.focus()
    window.scrollTo(0, 0)
  }, [location.pathname, title])

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Sidebar">
        <NavLink to="/" className="brand" aria-label="Shelf home" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon"><BookOpen size={21} aria-hidden="true" /></span>
          <span>Shelf<span className="brand-subtitle">A WORLD OF IDEAS</span></span>
        </NavLink>
        <button ref={menuButtonRef} className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav id="primary-navigation" aria-label="Primary" className={`navigation ${menuOpen ? 'navigation-open' : ''}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus() }
          }}>
          {(['Library', 'Workspace'] as const).map(section => (
            <div key={section} className="nav-group">
              <p className="eyebrow mb-3 px-3">{section}</p>
              {navigation.filter(item => item.section === section).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
                  onClick={() => setMenuOpen(false)}>
                  <Icon size={18} aria-hidden="true" /><span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Application foundation<span className="block mt-2 text-xs text-muted">Phase 1 · Development</span></div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted"><span>Library</span><ChevronRight size={13} aria-hidden="true" /><span className="truncate text-ink">{title}</span></div>
          <span className="phase-badge">Foundation</span>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1} className="page-content">
          {environment.status !== 'configured' && (
            <section role="status" aria-label="Configuration status" className="config-notice">
              <strong>{environment.status === 'invalid' ? 'Configuration needs attention' : 'Supabase is not configured'}</strong>
              <p>The application shell is available. Connected features are not enabled.</p>
              <details><summary>Configuration details</summary><ul>{environment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>
            </section>
          )}
          {pendingNavigation.state === 'loading' ? <LoadingState /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
