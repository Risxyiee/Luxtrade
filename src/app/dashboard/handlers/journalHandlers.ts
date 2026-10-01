import { JournalEntry } from '../utils/types'
import { toast } from 'sonner'

interface JournalHandlersProps {
  journalForm: { title: string; content: string; mood: string; market_condition: string }
  setJournalForm: (form: { title: string; content: string; mood: string; market_condition: string }) => void
  addJournalOpen: boolean
  setAddJournalOpen: (open: boolean) => void
  editJournalOpen: boolean
  setEditJournalOpen: (open: boolean) => void
  selectedJournal: JournalEntry | null
  setSelectedJournal: (entry: JournalEntry | null) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  fetchData: (isRefresh?: boolean) => void
  language: 'id' | 'en'
}

export const createJournalHandlers = ({
  journalForm,
  setJournalForm,
  addJournalOpen,
  setAddJournalOpen,
  editJournalOpen,
  setEditJournalOpen,
  selectedJournal,
  setSelectedJournal,
  saving,
  setSaving,
  fetchData,
  language
}: JournalHandlersProps) => {
  
  const handleAddJournal = async () => {
    if (!journalForm.title || !journalForm.content) {
      toast.error(language === 'id' ? 'Isi judul dan konten' : 'Please fill title and content')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(journalForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success(language === 'id' ? 'Jurnal berhasil ditambahkan!' : 'Journal entry added!')
        setAddJournalOpen(false)
        setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
        fetchData(true)
      } else {
        if (data.code === 'JOURNAL_LIMIT_EXCEEDED') {
          toast.error(language === 'id' ? 'Batas jurnal bulanan tercapai. Upgrade ke Pro!' : 'Monthly journal limit reached. Upgrade to Pro!')
        } else {
          toast.error(data.error || (language === 'id' ? 'Gagal menambahkan jurnal' : 'Failed to add entry'))
        }
      }
    } catch {
      toast.error(language === 'id' ? 'Gagal menambahkan jurnal' : 'Failed to add journal entry')
    } finally {
      setSaving(false)
    }
  }

  const handleEditJournalSave = async (editData: { title: string; content: string; mood: string; market_condition: string }) => {
    if (!selectedJournal) return
    if (!editData.title || !editData.content) {
      toast.error(language === 'id' ? 'Isi judul dan konten' : 'Please fill title and content')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: selectedJournal.id, ...editData })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(language === 'id' ? 'Jurnal berhasil diperbarui!' : 'Journal entry updated!')
        setEditJournalOpen(false)
        setSelectedJournal(null)
        fetchData(true)
      } else {
        toast.error(data.error || (language === 'id' ? 'Gagal memperbarui jurnal' : 'Failed to update entry'))
      }
    } catch {
      toast.error(language === 'id' ? 'Gagal memperbarui jurnal' : 'Failed to update journal entry')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDeleteJournal = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/journal?id=${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        toast.success(language === 'id' ? 'Jurnal berhasil dihapus!' : 'Journal entry deleted!')
        fetchData(true)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || (language === 'id' ? 'Gagal menghapus jurnal' : 'Failed to delete entry'))
      }
    } catch {
      toast.error(language === 'id' ? 'Gagal menghapus jurnal' : 'Failed to delete journal entry')
    } finally {
      setSaving(false)
    }
  }

  return {
    handleAddJournal,
    handleEditJournalSave,
    handleDeleteJournal
  }
}
