'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  showTime?: boolean
  placeholder?: string
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  showTime = true,
  placeholder = 'Pick a date',
  className,
}: DatePickerProps) {
  const [time, setTime] = React.useState(
    date ? format(date, 'HH:mm') : '00:00'
  )

  // Update time state when date changes externally
  React.useEffect(() => {
    if (date) {
      setTime(format(date, 'HH:mm'))
    }
  }, [date])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      if (showTime) {
        const [hours, minutes] = time.split(':').map(Number)
        selectedDate.setHours(hours || 0, minutes || 0, 0, 0)
      }
      onDateChange(selectedDate)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
    if (date && showTime) {
      const [hours, minutes] = newTime.split(':').map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours || 0, minutes || 0, 0, 0)
      onDateChange(newDate)
    }
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex-1 justify-start text-left font-normal bg-[#0a0712] border-purple-900/30 hover:bg-purple-900/20',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
            {date ? format(date, 'MMM dd, yyyy') : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#0f0b18] border-purple-900/30" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className="bg-[#0f0b18]"
          />
        </PopoverContent>
      </Popover>
      {showTime && (
        <div className="relative">
          <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
          <Input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-28 bg-[#0a0712] border-purple-900/30 pl-8"
          />
        </div>
      )}
    </div>
  )
}
