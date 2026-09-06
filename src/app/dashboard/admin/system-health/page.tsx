'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Database,
  AlertTriangle,
  Server,
  Zap,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

const ADMIN_IDS: string[] = []
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

function checkIsAdmin(userId: string | undefined, email: string | undefined): boolean {
  if (userId && ADMIN_IDS.includes(userId)) return true
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}

interface HealthCheckResult {
  name: string
  status: 'healthy' | 'unhealthy'
  responseTime?: number
  error?: string
}

interface HealthCheckResponse {
  timestamp: string
  totalResponseTime: number
  summary: {
    total: number
    healthy: number
    unhealthy: number
    overallHealth: 'healthy' | 'unhealthy' | 'degraded'
  }
  results: HealthCheckResult[]
}

export default function SystemHealthPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Please login first')
        router.push('/auth/login')
        return
      }

      if (!checkIsAdmin(user.id, user.email)) {
        toast.error('Access denied. Admin only.')
        router.push('/dashboard')
        return
      }

      setIsAdminUser(true)
      setCheckingAuth(false)
    }

    checkAuth()
  }, [router])

  const fetchHealthCheck = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/health-check')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setHealthData(data)
    } catch (error) {
      console.error('Health check failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch health check data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdminUser && !checkingAuth) {
      fetchHealthCheck()
    }
  }, [isAdminUser, checkingAuth])

  const handleRefresh = () => {
    fetchHealthCheck()
  }

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const getOverallHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'unhealthy':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      default:
        return <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
    }
  }

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes('Database')) return <Database className="h-5 w-5" />
    if (serviceName.includes('API') || serviceName.includes('Trades') || serviceName.includes('Journal')) return <Server className="h-5 w-5" />
    if (serviceName.includes('AI')) return <Zap className="h-5 w-5" />
    return <Activity className="h-5 w-5" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="h-6 w-6" />
                  System Health Dashboard
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Real-time monitoring of critical system components
                </p>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Running Diagnostics...' : 'Run Diagnostics'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {healthData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Overall Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold capitalize">
                        {healthData.summary.overallHealth}
                      </p>
                      <p className="text-sm opacity-80">
                        {healthData.summary.healthy}/{healthData.summary.total} systems healthy
                      </p>
                    </div>
                    <div className="text-4xl opacity-80">
                      {getStatusIcon(healthData.summary.overallHealth)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Total Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    {healthData.totalResponseTime}ms
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    All checks completed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Healthy Systems
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {healthData.summary.healthy}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Systems operational
                  </p>
                </CardContent>
              </Card>

              {healthData.summary.unhealthy > 0 && (
                <Card className="border-red-200 dark:border-red-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      Unhealthy Systems
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {healthData.summary.unhealthy}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Systems requiring attention
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Diagnostics Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Last Check:</span>
                    <Badge variant="outline">
                      {new Date(healthData.timestamp).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Overall Status:</span>
                    <Badge className={getOverallHealthColor(healthData.summary.overallHealth)}>
                      {healthData.summary.overallHealth.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Service Health Status
                </CardTitle>
                <CardDescription>
                  Detailed status of all system components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                          Service
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                          Response Time
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthData.results.map((result, index) => (
                        <tr
                          key={index}
                          className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                result.status === 'healthy'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              }`}>
                                {getServiceIcon(result.name)}
                              </div>
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {result.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              className={
                                result.status === 'healthy'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }
                            >
                              {result.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            {result.responseTime !== undefined ? (
                              <span className="text-slate-700 dark:text-slate-300">
                                {result.responseTime}ms
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {result.error ? (
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-red-600 dark:text-red-400 break-words">
                                  {result.error}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                All systems operational
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {healthData.summary.unhealthy > 0 && (
              <Card className="mt-6 border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-900/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {healthData.summary.unhealthy} system(s) are currently unhealthy. Please review the error messages above and take appropriate action to restore system functionality.
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
