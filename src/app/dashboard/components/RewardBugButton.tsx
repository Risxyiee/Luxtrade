/**
 * Admin Bug Report Reward Button Snippet
 *
 * This snippet shows how to add a "Beri Hadiah PRO" button in Admin Panel
 * that will call the /api/admin/reward-bug API to reward bug reporters.
 *
 * USAGE:
 * 1. Import this component or copy the code into your admin panel
 * 2. Pass the bugReport.id as the reportId prop
 * 3. Make sure the user is authenticated with admin role
 *
 * Prerequisites:
 * - Admin must be logged in with valid JWT token
 * - Bug report must exist in database
 * - Bug report status must not be 'REWARDED' yet
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Gift, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface RewardBugButtonProps {
  reportId: string
  currentStatus: string
  onRewardSuccess?: (reportId: string) => void
  userId?: string // Optional: to show user email
}

export function RewardBugButton({
  reportId,
  currentStatus,
  onRewardSuccess,
  userId
}: RewardBugButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleReward = async () => {
    // Prevent duplicate rewards
    if (currentStatus === 'REWARDED') {
      toast.info('Bug report ini sudah diberikan hadiah.')
      return
    }

    // Confirm action
    const confirmed = window.confirm(
      'Apakah Anda yakin ingin memberikan hadiah PRO 30 hari kepada user ini?'
    )
    if (!confirmed) return

    setLoading(true)

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Anda harus login sebagai admin untuk memberikan hadiah.')
        return
      }

      // Call API
      const response = await fetch('/api/admin/reward-bug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reportId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Unauthorized. Anda harus login sebagai admin.')
        } else if (response.status === 403) {
          toast.error('Forbidden. Hanya admin yang bisa memberikan hadiah.')
        } else if (response.status === 404) {
          toast.error('Bug report tidak ditemukan.')
        } else {
          toast.error(result.error || 'Gagal memberikan hadiah.')
        }
        return
      }

      // Success
      toast.success(
        `🎉 Berhasil! User mendapatkan akses PRO 30 hari. Berlaku hingga: ${new Date(result.bugReport.subscriptionExtendedUntil).toLocaleDateString('id-ID')}`,
        { duration: 5000 }
      )

      // Notify parent component
      if (onRewardSuccess) {
        onRewardSuccess(reportId)
      }

    } catch (error) {
      console.error('Error rewarding bug report:', error)
      toast.error('Terjadi kesalahan saat memberikan hadiah.')
    } finally {
      setLoading(false)
    }
  }

  // Already rewarded - show checkmark
  if (currentStatus === 'REWARDED') {
    return (
      <Button variant="outline" disabled className="gap-2 text-green-600">
        <CheckCircle className="w-4 h-4" />
        Sudah Diberi Hadiah
      </Button>
    )
  }

  // Show reward button
  return (
    <Button
      onClick={handleReward}
      disabled={loading}
      className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Memproses...
        </>
      ) : (
        <>
          <Gift className="w-4 h-4" />
          Beri Hadiah PRO
        </>
      )}
    </Button>
  )
}

/**
 * EXAMPLE USAGE IN ADMIN PANEL:
 *
 * import { RewardBugButton } from './RewardBugButton'
 *
 * function BugReportsTable() {
 *   const [bugReports, setBugReports] = useState([])
 *
 *   const handleRewardSuccess = (reportId: string) => {
 *     // Update the bug report status in local state
 *     setBugReports(prev =>
 *       prev.map(report =>
 *         report.id === reportId
 *           ? { ...report, status: 'REWARDED' }
 *           : report
 *       )
 *     )
 *   }
 *
 *   return (
 *     <table>
 *       <thead>
 *         <tr>
 *           <th>ID</th>
 *           <th>Description</th>
 *           <th>Status</th>
 *           <th>Action</th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {bugReports.map(report => (
 *           <tr key={report.id}>
 *             <td>{report.id}</td>
 *             <td>{report.description}</td>
 *             <td>
 *               <Badge variant={
 *                 report.status === 'REWARDED' ? 'success' :
 *                 report.status === 'PENDING' ? 'warning' : 'default'
 *               }>
 *                 {report.status}
 *               </Badge>
 *             </td>
 *             <td>
 *               <RewardBugButton
 *                 reportId={report.id}
 *                 currentStatus={report.status}
 *                 onRewardSuccess={handleRewardSuccess}
 *               />
 *             </td>
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   )
 * }
 */

export default RewardBugButton