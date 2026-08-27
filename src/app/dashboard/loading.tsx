export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0f051d] flex">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col w-64 border-r border-white/[0.06] p-4 gap-4 animate-pulse">
        <div className="h-10 w-32 bg-white/[0.06] rounded-xl" />
        <div className="flex-1 space-y-2 mt-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.03] rounded-lg" style={{ width: i === 0 ? '100%' : `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
        <div className="h-10 w-full bg-white/[0.04] rounded-lg" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
          </div>
          <p className="text-white/40 text-sm">Loading dashboard...</p>
        </div>
      </div>
    </div>
  )
}