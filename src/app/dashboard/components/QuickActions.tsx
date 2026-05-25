'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface QuickActionsProps {
  onAddTrade: () => void
  language: 'id' | 'en'
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAddTrade, language }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button
        onClick={onAddTrade}
        className="bg-gradient-to-r from-purple-500 to-violet-600 shadow-lg shadow-purple-500/20"
      >
        <Plus className="w-4 h-4 mr-2" />
        {language === 'id' ? 'Tambah Trade Pertama' : 'Add Your First Trade'}
      </Button>
    </div>
  )
}
