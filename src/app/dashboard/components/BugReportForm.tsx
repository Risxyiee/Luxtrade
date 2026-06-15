'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Upload, X, Bug, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BugReportFormProps {
  open: boolean
  onClose: () => void
}

export function BugReportForm({ open, onClose }: BugReportFormProps) {
  const [description, setDescription] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB')
      return
    }

    setScreenshotFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeScreenshot = () => {
    setScreenshotFile(null)
    setScreenshotPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      toast.error('Deskripsi bug harus diisi')
      return
    }

    if (description.trim().length > 5000) {
      toast.error('Deskripsi maksimal 5000 karakter')
      return
    }

    setLoading(true)

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Anda harus login untuk mengirim laporan bug')
        return
      }

      let screenshotUrl: string | null = null

      // Upload screenshot if provided
      if (screenshotFile) {
        const fileExt = screenshotFile.name.split('.').pop()
        const fileName = `bug-${Date.now()}.${fileExt}`
        const filePath = `bug-reports/${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(filePath, screenshotFile)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Gagal mengupload screenshot')
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('screenshots')
          .getPublicUrl(filePath)

        screenshotUrl = publicUrl
      }

      // Submit bug report
      const response = await fetch('/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          description: description.trim(),
          screenshotUrl
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengirim laporan bug')
      }

      toast.success('Laporan bug berhasil dikirim! Terima kasih atas kontribusi Anda.', {
        duration: 5000
      })

      // Reset form
      setDescription('')
      setScreenshotFile(null)
      setScreenshotPreview(null)

      onClose()

    } catch (error: any) {
      console.error('Error submitting bug report:', error)
      toast.error(error.message || 'Gagal mengirim laporan bug')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Bug className="w-6 h-6 text-orange-500" />
            Laporkan Bug
          </DialogTitle>
          <DialogDescription>
            Temukan bug? Dapatkan akses PRO 30 hari sebagai hadiah! 🎁
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">
              Deskripsi Bug <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Jelaskan bug yang Anda temukan secara detail. Apa yang terjadi? Kapan terjadi? Apa yang Anda lakukan sebelumnya?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
              maxLength={5000}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground text-right">
              {description.length} / 5000 karakter
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">
              Screenshot (Opsional)
            </Label>
            <div className="space-y-3">
              {!screenshotPreview ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <Input
                    id="screenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="screenshot"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">
                        Klik untuk upload screenshot
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, atau WEBP (maks 10MB)
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="relative group">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={removeScreenshot}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Gift className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-blue-900 dark:text-blue-100">
                  Dapatkan Hadiah PRO!
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Setiap bug yang Anda laporkan dan diverifikasi akan memberikan Anda akses PRO 30 hari. Admin akan mereview laporan Anda dalam waktu 1-2 hari kerja.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Bug className="w-4 h-4 mr-2" />
                  Kirim Laporan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}