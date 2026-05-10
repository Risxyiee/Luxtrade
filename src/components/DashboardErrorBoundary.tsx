'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DashboardErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface DashboardErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })

    // Log additional info for debugging
    console.error('Error stack:', error.stack)
    console.error('Component stack:', errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <DashboardErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
        />
      )
    }

    return this.props.children
  }
}

function DashboardErrorFallback({ error, errorInfo }: { error?: Error; errorInfo?: React.ErrorInfo }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0712] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-red-500/20 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Dashboard Error</h1>
        <p className="text-gray-400 text-sm mb-6">
          Something went wrong while loading your dashboard. This is usually temporary.
        </p>

        {error && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300 mb-2">
              Error Details
            </summary>
            <div className="bg-black/30 rounded-lg p-3 text-xs text-red-400 font-mono overflow-auto max-h-32">
              <p>{error.toString()}</p>
              {error.stack && (
                <pre className="mt-2 whitespace-pre-wrap opacity-75">
                  {error.stack}
                </pre>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white rounded-lg text-sm font-medium transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>

          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  )
}
