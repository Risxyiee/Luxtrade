export const dynamic = 'force-static'

export async function generateStaticParams() {
  return [
    { slug: 'cara-menggunakan-jurnal-trading-untuk-menjadi-trader-konsisten' },
    { slug: '5-kesalahan-psikologi-trading-paling-umum' },
    { slug: 'manajemen-risiko-trading-pemula' },
    { slug: 'analisis-ai-dalam-trading-modern' },
    { slug: 'membangun-strategi-trading-yang-teruji' },
    { slug: 'mengapa-95-persen-trader-gagal' },
  ]
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
