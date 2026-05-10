'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ChartErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="w-full bg-gradient-to-br from-[#0f0b18] to-[#1a0f2e] border border-red-500/20 rounded-xl overflow-hidden p-6" suppressHydrationWarning={true}>
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Chart Error</h3>
              <p className="text-gray-400 text-sm">
                Unable to load trading chart at this time.
              </p>
            </div>
            <button
              onClick={() => {
                try {
                  window.location.reload()
                } catch (e) {
                  console.error('Error reloading page:', e)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
