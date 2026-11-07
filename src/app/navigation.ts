import { Bookmark, Compass, Home, LayoutDashboard, PenLine, ReceiptText, UserRound } from 'lucide-react'

export const navigation = [
  { to: '/', label: 'Home', icon: Home, section: 'Library' },
  { to: '/explore', label: 'Explore', icon: Compass, section: 'Library' },
  { to: '/library', label: 'My Library', icon: Bookmark, section: 'Library' },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText, section: 'Library' },
  { to: '/account', label: 'Account', icon: UserRound, section: 'Library' },
  { to: '/contribute', label: 'Contribute', icon: PenLine, section: 'Workspace' },
  { to: '/admin', label: 'Admin dashboard', icon: LayoutDashboard, section: 'Workspace', adminOnly: true },
] as const

export const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/library', label: 'Library', icon: Bookmark },
  { to: '/account', label: 'Account', icon: UserRound },
] as const
