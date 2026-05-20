'use client'

import { Card, CardContent, CardHeader } from './card'

export function SkeletonCard() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-20 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded" />
        <div className="w-10 h-10 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-2" />
        <div className="h-3 w-16 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-shimmer rounded" />
      </CardContent>
    </Card>
  )
}

export function SkeletonHero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 via-violet-600/10 to-amber-500/10 border-purple-500/30 backdrop-blur-sm rounded-xl">
      <div className="p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="h-4 w-32 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-3" />
            <div className="h-8 w-64 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded mb-2" />
            <div className="h-4 w-96 bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-shimmer rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-16 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
            <div className="h-16 w-24 bg-gradient-to-r from-white/10 via-white/15 to-white/10 animate-shimmer rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
