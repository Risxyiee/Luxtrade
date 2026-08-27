'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Plus } from 'lucide-react'

interface TodoItem {
  id: string
  text: string
  completed: boolean
}

interface TodoSectionProps {
  todos?: TodoItem[]
  onToggle?: (id: string) => void
  onAdd?: () => void
  language: 'id' | 'en'
}

export const TodoSection: React.FC<TodoSectionProps> = ({
  todos = [],
  onToggle,
  onAdd,
  language
}) => {
  const defaultTodos: TodoItem[] = [
    { id: '1', text: language === 'id' ? 'Catat trade harian' : 'Log daily trades', completed: false },
    { id: '2', text: language === 'id' ? 'Review performa mingguan' : 'Review weekly performance', completed: false },
    { id: '3', text: language === 'id' ? 'Update jurnal trading' : 'Update trading journal', completed: false },
  ]

  const displayTodos = todos.length > 0 ? todos : defaultTodos

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#080b12]/80 dark:to-[#12091a]/80 backdrop-blur-md border-lux-border dark:border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            {language === 'id' ? 'Tugas Trading' : 'Trading Tasks'}
          </CardTitle>
          {onAdd && (
            <button
              onClick={onAdd}
              className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayTodos.map((todo, index) => (
              <motion.div
                key={todo.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-lux-surface-hover dark:bg-white/5 hover:bg-lux-surface-hover dark:hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => onToggle?.(todo.id)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  todo.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-500 group-hover:border-cyan-400'
                }`}>
                  {todo.completed && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className={`text-sm ${todo.completed ? 'text-lux-text-muted dark:text-gray-500 line-through' : 'text-gray-200'}`}>
                  {todo.text}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
