export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0f051d] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
        </div>
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  )
}