/**
 * discord-commands.ts — SATU SUMBER DEFINISI SLASH COMMAND DISCORD.
 *
 * Dipakai dua tempat (WAJIB sinkron — Discord bulk overwrite PUT menghapus
 * command yang tidak ada di daftar):
 *   1. /api/discord-interactions  → auto-register (PING + GET + cron 08:00)
 *   2. /api/ceo-agent action=discord-setup (tombol 🤖 di Ruang Rapat)
 *
 * CATATAN INTERACTIONS ENDPOINT (serverless — tanpa Gateway WebSocket):
 * bot hanya bisa merespons SLASH COMMAND. Pesan biasa / mention di channel
 * tidak memicu HTTP POST ke endpoint (butuh koneksi WS yang selalu hidup,
 * mustahil di Cloudflare Workers Free).
 */

export interface DiscordCommandOption {
  /** 3 = STRING (satu-satunya type yang dipakai di sini) */
  type: number
  name: string
  description: string
  required: boolean
}

export interface DiscordCommandDef {
  name: string
  description: string
  options?: DiscordCommandOption[]
}

const optId: DiscordCommandOption = {
  type: 3, name: 'id', required: false,
  description: 'ID proposal (kosongkan = ambil teratas; boleh potongan awal id)',
}

export const DISCORD_COMMANDS: DiscordCommandDef[] = [
  {
    name: 'bos',
    description: 'Ngobrol dengan Alexander (CEO AI Luxtradee)',
    options: [{ type: 3, name: 'pesan', description: 'Pertanyaan atau perintahmu', required: true }],
  },
  {
    name: 'setuju',
    description: '✅ ACC & EKSEKUSI proposal karyawan teratas di Antrean Eksekusi',
    options: [optId],
  },
  {
    name: 'tolak',
    description: '❌ Tolak proposal karyawan di Antrean Eksekusi',
    options: [optId],
  },
  {
    name: 'kerjakan',
    description: '🫡 Pencicit — kerjakan 1 tugas karyawan AI yang jatuh tempo sekarang',
    options: [{
      type: 3, name: 'job', required: false,
      description: 'ID job (mis. cmo:calendar) — kosongkan = otomatis pilih',
    }],
  },
  {
    name: 'laksanakan',
    description: '🚀 Jalankan SEMUA tugas karyawan AI jatuh tempo, satu per satu (maks 8)',
  },
  {
    name: 'antrean',
    description: '📋 Lihat proposal karyawan yang menunggu ACC Bos',
  },
  {
    name: 'status',
    description: '🏢 Status kantor: fase bisnis + antrean ACC',
  },
  { name: 'nba-oke', description: 'Setujui prioritas hari ini (NBA dieksekusi)' },
  { name: 'nba-not', description: 'Tolak prioritas hari ini — Alexander pilih ganti' },
]
