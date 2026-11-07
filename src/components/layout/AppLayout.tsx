import { DevelopmentAccount } from '../../features/borrowing/DevelopmentAccount'
import { BookOpen, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate, useNavigation } from 'react-router'
import { LoadingState } from '../states/LoadingState'
import { navigation, tabs } from '../../app/navigation'
import { useServices } from '../../app/services'
import { useSession } from '../../features/borrowing/session'
import { useIsAdmin } from '../../features/account/useRole'
import { useWalletDiscovery } from '../../features/wallet/useWalletDiscovery'
import { initials } from '../../lib/format'

function Brand({ className = '' }: { className?: string }) {
  return <Link to="/" className={`brand ${className}`} aria-label="Shelf home"><BookOpen size={22} strokeWidth={1.75} aria-hidden="true" /><span>Shelf</span></Link>
}

export function AppLayout() {
  useWalletDiscovery()
  const { environment } = useServices()
  const { session } = useSession()
  const admin = useIsAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const matches = useMatches()
  const pendingNavigation = useNavigation()
  const current = matches.at(-1)?.handle as { title?: string } | undefined
  const title = current?.title ?? 'Shelf'

  useEffect(() => {
    document.title = `${title} · Shelf`
    mainRef.current?.focus()
    window.scrollTo(0, 0)
  }, [location.pathname, title])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const email = session?.user.email
  const avatar = session
    ? <span className="avatar" aria-hidden="true">{initials(email)}</span>
    : <span className="avatar avatar-guest" aria-hidden="true">?</span>

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Sidebar">
        <Brand />
        <nav aria-label="Primary">
          {(['Library', 'Workspace'] as const).map(section => (
            <div key={section} className="nav-section">
              <p className="nav-label">{section}</p>
              <div className="nav-list">
                {navigation.filter(item => item.section === section && (!('adminOnly' in item) || admin)).map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <Link to="/account" className="user-card">
          {avatar}
          <div>
            <strong>{session ? email : 'Sign in'}</strong>
            <span>{session ? (admin ? 'Administrator' : 'Reader') : 'Email code and Nimiq Pay'}</span>
          </div>
        </Link>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <Brand className="topbar-brand" />
          <form className="top-search" role="search" onSubmit={(event) => {
            event.preventDefault()
            const q = query.trim()
            navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
            searchRef.current?.blur()
          }}>
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <label className="sr-only" htmlFor="top-search">Search books</label>
            <input id="top-search" ref={searchRef} type="search" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
            <span className="keycap" aria-hidden="true">/</span>
          </form>
          <Link to="/account" className="topbar-account" aria-label={session ? `Account · ${email}` : 'Sign in'}>{avatar}</Link>
        </header>
        <main id="main-content" ref={mainRef} tabIndex={-1} className="page-content">
          {environment.status !== 'configured' && (
            <section role="status" aria-label="Configuration status" className="config-notice">
              <strong>{environment.status === 'invalid' ? 'Configuration needs attention' : 'Supabase is not configured'}</strong>
              <p>The application shell is available. Connected features are not enabled.</p>
              <details><summary>Configuration details</summary><ul>{environment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>
            </section>
          )}
          <DevelopmentAccount />
          {pendingNavigation.state === 'loading' ? <LoadingState /> : <Outlet />}
        </main>
      </div>
      <nav className="tabbar" aria-label="Tabs">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
