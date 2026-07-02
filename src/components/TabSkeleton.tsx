'use client'

export function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      <div className="h-8 bg-white/5 rounded-lg w-1/3" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
        <div className="h-48 bg-white/[0.03] border border-white/[0.06] rounded-2xl" />
      </div>
    </div>
  )
}