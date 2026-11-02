import { Component, type ReactNode } from 'react'
import { ErrorState } from '../components/states/ErrorState'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return <main className="min-h-screen p-6"><ErrorState onRetry={() => window.location.reload()} /></main>
    }
    return this.props.children
  }
}
