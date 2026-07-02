'use client'

import { Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountToDelete: any
  deleting: boolean
  handleDeleteAccount: () => void
}

export default function DeleteAccountDialog({
  open,
  onOpenChange,
  accountToDelete,
  deleting,
  handleDeleteAccount
}: DeleteAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Hapus Akun Trading
          </DialogTitle>
          <DialogDescription className="text-gray-400 mt-2">
            Apakah Anda yakin ingin menghapus akun trading "{accountToDelete?.name}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {accountToDelete?.is_default && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-sm text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Ini adalah akun default. Setelah dihapus, akun lain akan otomatis dijadikan default.</span>
              </p>
            </div>
          )}

          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Tindakan ini tidak dapat dibatalkan. Semua data trading yang terkait dengan akun ini akan tetap tersimpan.</span>
            </p>
          </div>

          <div className="text-sm text-gray-400">
            <p>Account: <span className="text-white font-medium">{accountToDelete?.name}</span></p>
            <p>Currency: <span className="text-white font-medium">{accountToDelete?.currency}</span></p>
            <p>Type: <span className="text-white font-medium">{accountToDelete?.account_type}</span></p>
            {accountToDelete?.is_default && (
              <p className="text-amber-400 font-medium">⚠️ Akun Default</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Batal
          </Button>
          <Button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Hapus Akun
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}