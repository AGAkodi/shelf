import { Bookmark, Compass, Home, LayoutDashboard, PenLine, Wallet } from 'lucide-react'

export const navigation = [
  { to: '/', label: 'Home', icon: Home, section: 'Library' },
  { to: '/explore', label: 'Explore', icon: Compass, section: 'Library' },
  { to: '/library', label: 'My Library', icon: Bookmark, section: 'Library' },
  { to: '/transactions', label: 'Transactions', icon: Wallet, section: 'Library' },
  { to: '/contribute', label: 'Contribute', icon: PenLine, section: 'Workspace' },
  { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, section: 'Workspace' },
] as const
