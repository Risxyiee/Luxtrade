'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X, Calendar, Filter } from 'lucide-react'
import { filterJournalEntries, getFilterOptions, JournalFilters, JournalEntry } from '@/lib/journal-search'

interface JournalFilterPanelProps {
  entries: JournalEntry[]
  onFilterChange: (filtered: JournalEntry[]) => void
}

export function JournalFilterPanel({ entries, onFilterChange }: JournalFilterPanelProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<JournalFilters>({})

  const filterOptions = useMemo(() => getFilterOptions(entries), [entries])

  // Compute filtered entries without side effects
  const filteredEntries = useMemo(() => {
    return filterJournalEntries(entries, filters)
  }, [entries, filters])

  // Notify parent when filtered entries change (via useEffect, not inside useMemo)
  useEffect(() => {
    onFilterChange(filteredEntries)
  }, [filteredEntries, onFilterChange])

  const handleSearchChange = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }))
  }, [])

  const handleMoodChange = useCallback((mood: string) => {
    setFilters(prev => ({
      ...prev,
      mood: prev.mood === mood ? undefined : mood
    }))
  }, [])

  const handleMarketConditionChange = useCallback((condition: string) => {
    setFilters(prev => ({
      ...prev,
      marketCondition: prev.marketCondition === condition ? undefined : condition
    }))
  }, [])

  const handleTagToggle = useCallback((tag: string) => {
    setFilters(prev => {
      const tags = prev.tags || []
      if (tags.includes(tag)) {
        return { ...prev, tags: tags.filter(t => t !== tag) }
      } else {
        return { ...prev, tags: [...tags, tag] }
      }
    })
  }, [])

  const handleDateFromChange = useCallback((date: string) => {
    setFilters(prev => ({
      ...prev,
      dateFrom: date ? new Date(date) : undefined
    }))
  }, [])

  const handleDateToChange = useCallback((date: string) => {
    setFilters(prev => ({
      ...prev,
      dateTo: date ? new Date(date) : undefined
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => {
      if (Array.isArray(v)) return v.length > 0
      return v !== undefined && v !== ''
    }).length
  }, [filters])

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-lux-text-secondary dark:text-gray-400" />
        <Input
          type="text"
          placeholder="Search journal entries..."
          value={filters.searchQuery || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 bg-lux-input-bg dark:bg-[#060810] border-lux-border dark:border-blue-500/20 text-white placeholder-gray-500"
        />
      </div>

      {/* Filter Toggle Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className="border-blue-500/30 text-blue-400"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters {activeFilterCount > 0 && <span className="ml-1 bg-blue-500 px-2 py-0.5 rounded-full text-xs">{activeFilterCount}</span>}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            size="sm"
            className="text-lux-text-secondary dark:text-gray-400 hover:text-red-400"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:to-[#080a14] border-lux-border dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-sm">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mood Filter */}
            {filterOptions.moods.length > 0 && (
              <div>
                <p className="text-sm font-medium text-lux-text-secondary dark:text-gray-400 mb-2">Mood</p>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.moods.map(mood => (
                    <Badge
                      key={mood}
                      variant={filters.mood === mood ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        filters.mood === mood
                          ? 'bg-blue-500 text-white'
                          : 'border-blue-500/30 text-blue-400'
                      }`}
                      onClick={() => handleMoodChange(mood)}
                    >
                      {mood}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Market Condition Filter */}
            {filterOptions.marketConditions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-lux-text-secondary dark:text-gray-400 mb-2">Market Condition</p>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.marketConditions.map(condition => (
                    <Badge
                      key={condition}
                      variant={filters.marketCondition === condition ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        filters.marketCondition === condition
                          ? 'bg-blue-500 text-white'
                          : 'border-blue-500/30 text-blue-400'
                      }`}
                      onClick={() => handleMarketConditionChange(condition)}
                    >
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Filter */}
            {filterOptions.tags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-lux-text-secondary dark:text-gray-400 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.tags.map(tag => (
                    <Badge
                      key={tag}
                      variant={filters.tags?.includes(tag) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        filters.tags?.includes(tag)
                          ? 'bg-blue-500 text-white'
                          : 'border-blue-500/30 text-blue-400'
                      }`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range Filter */}
            <div>
              <p className="text-sm font-medium text-lux-text-secondary dark:text-gray-400 mb-2">Date Range</p>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-lux-text-muted dark:text-gray-500" />
                  <input
                    type="date"
                    value={filters.dateFrom?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="pl-8 w-full px-3 py-2 rounded-lg bg-lux-surface-hover dark:bg-white/5 border border-lux-border dark:border-blue-500/20 text-sm text-lux-text-primary dark:text-white"
                  />
                </div>
                <span className="text-lux-text-muted dark:text-gray-500">to</span>
                <div className="flex-1 relative">
                  <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-lux-text-muted dark:text-gray-500" />
                  <input
                    type="date"
                    value={filters.dateTo?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="pl-8 w-full px-3 py-2 rounded-lg bg-lux-surface-hover dark:bg-white/5 border border-lux-border dark:border-blue-500/20 text-sm text-lux-text-primary dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="pt-2 border-t border-blue-500/10">
              <p className="text-sm text-lux-text-secondary dark:text-gray-400">
                Showing <span className="font-bold text-blue-400">{filteredEntries.length}</span> of <span className="font-bold">{entries.length}</span> entries
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}