import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f051d] text-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold mb-2">Halaman Tidak Ditemukan</h2>
        <p className="text-gray-400 mb-8">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/30"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  )
}