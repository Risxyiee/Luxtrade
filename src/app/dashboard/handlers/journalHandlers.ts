import { JournalEntry } from '../utils/types'
import { toast } from 'sonner'

interface JournalHandlersProps {
  journalForm: { title: string; content: string; mood: string; market_condition: string }
  setJournalForm: (form: { title: string; content: string; mood: string; market_condition: string }) => void
  addJournalOpen: boolean
  setAddJournalOpen: (open: boolean) => void
  saving: boolean
  setSaving: (saving: boolean) => void
  fetchData: () => void
}

export const createJournalHandlers = ({
  journalForm,
  setJournalForm,
  addJournalOpen,
  setAddJournalOpen,
  saving,
  setSaving,
  fetchData
}: JournalHandlersProps) => {
  
  const handleAddJournal = async () => {
    if (!journalForm.title || !journalForm.content) {
      toast.error('Please fill title and content')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalForm)
      })
      
      const data = await res.json()
      if (res.ok) {
        toast.success('Journal entry added!')
        setAddJournalOpen(false)
        setJournalForm({ title: '', content: '', mood: '', market_condition: '' })
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add entry')
      }
    } catch {
      toast.error('Failed to add journal entry')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDeleteJournal = async (id: string) => {
    if (!confirm('Delete this journal entry?')) return

    try {
      const res = await fetch(`/api/journal?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entry deleted!')
        fetchData()
      }
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  return {
    handleAddJournal,
    handleDeleteJournal
  }
}
