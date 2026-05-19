'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function CleanupPage() {
  const router = useRouter()
  const [isCleaning, setIsCleaning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleCleanup = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua akun yang terjebak (stuck) dalam status PENDING selama lebih dari 1 jam?')) {
      return
    }

    setIsCleaning(true)
    setResult(null)

    try {
      const response = await fetch('/api/trading-accounts/cleanup', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)

      if (data.deleted > 0) {
        toast.success(`Berhasil menghapus ${data.deleted} akun yang terjebak`)
      } else {
        toast.info('Tidak ada akun yang terjebak ditemukan')
      }
    } catch (error) {
      console.error('Cleanup error:', error)
      toast.error('Gagal melakukan cleanup akun')
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/connections')}
            className="text-white/60 hover:text-white"
          >
            ← Kembali
          </Button>
        </div>

        <Card className="bg-[#1a1025] border border-purple-500/30">
          <CardHeader className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-purple-500/30">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Trash2 className="w-5 h-5 text-red-400" />
              Cleanup Akun Trading Terjebak
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <p className="text-white/70 text-sm">
                Fitur ini akan menghapus akun trading yang terjebak (stuck) dalam status
                <span className="text-yellow-400 font-bold"> PENDING</span> selama lebih dari 1 jam.
                Akun-akun ini biasanya gagal terhubung ke MetaApi tapi tidak ter-rollback dengan baik.
              </p>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm font-medium mb-2">⚠️ Peringatan</p>
                <p className="text-white/60 text-xs">
                  Tindakan ini akan menghapus akun trading secara permanen dari database.
                  Pastikan untuk hanya menggunakan fitur ini jika akun benar-benar terjebak
                  dan tidak bisa diakses.
                </p>
              </div>

              <Button
                onClick={handleCleanup}
                disabled={isCleaning}
                className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white"
              >
                {isCleaning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sedang membersihkan...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Jalankan Cleanup
                  </>
                )}
              </Button>

              {result && (
                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Cleanup Selesai!</span>
                  </div>
                  <p className="text-white/70 text-sm">
                    Berhasil menghapus {result.deleted} akun yang terjebak
                  </p>
                  {result.accounts && result.accounts.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {result.accounts.map((acc: any) => (
                        <div key={acc.id} className="text-white/50 text-xs">
                          - Akun {acc.account_number} ({acc.created_at})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
