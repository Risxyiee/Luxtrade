// @ts-ignore
import { Server } from 'socket.io'

const PORT = 3004

/* 🔐 HARDENING (penutup temuan audit "affiliate-ws tanpa auth"): event RELAY
   (affiliate:event / affiliate:broadcast) memuntahkan pesan apa pun ke room
   user mana pun — dulu siapa pun yang tahu port ini bisa spoof notifikasi
   "komisi masuk". Kini relay WAJIB menyertakan token shared secret
   (AFFILIATE_WS_TOKEN) yang sama dgn sisi API route.
   Belum ada producer resmi hari ini → kalau token TIDAK diset, relay
   FAIL-CLOSED (ditolak semua) tanpa memutus fitur yang ada: halaman
   affiliate hanya pakai join/leave + listen, dan itu tetap terbuka. */
const AUTH_TOKEN = (process.env.AFFILIATE_WS_TOKEN || '').trim()

function relayAuthorized(payload: unknown): boolean {
  if (!AUTH_TOKEN) return false // belum dikonfigurasi → relay dimatikan (anti-spoof)
  return (payload as { token?: unknown } | null)?.token === AUTH_TOKEN
}

/* 🛡️ HOT-RELOAD SAFE (bun --hot): modul di re-eval di proses yang SAMA saat
   file berubah. Kalau `new Server(PORT)` dijalankan ulang, bind port 3004
   bisa bentrok dgn instance lama. Solusi: cache instance server + flag
   pendaftaran handler di globalThis — eval pertama bikin server & pasang
   handler, eval berikutnya reuse. */
const G = globalThis as Record<string, unknown>

const io = (G.__affiliateIO as Server | undefined) ?? new Server(PORT, {
  cors: {
    origin: '*', // Allow all origins in dev
    methods: ['GET', 'POST'],
  },
})
G.__affiliateIO = io

if (!G.__affiliateWired) {
  G.__affiliateWired = true

  // Track connected clients by user_id for targeted updates
  const clients = new Map<string, Set<string>>() // userId -> Set<socketId>

  io.on('connection', (socket) => {
    console.log(`[affiliate-ws] Client connected: ${socket.id}`)

    // User joins their personal room
    socket.on('affiliate:join', (userId: string) => {
      if (!userId || typeof userId !== 'string') return
      socket.join(`user:${userId}`)

      if (!clients.has(userId)) {
        clients.set(userId, new Set())
      }
      clients.get(userId)!.add(socket.id)
      console.log(`[affiliate-ws] User ${userId} joined (${clients.get(userId)!.size} connections)`)
    })

    // User leaves their room
    socket.on('affiliate:leave', (userId: string) => {
      if (!userId) return
      socket.leave(`user:${userId}`)
      const userClients = clients.get(userId)
      if (userClients) {
        userClients.delete(socket.id)
        if (userClients.size === 0) {
          clients.delete(userId)
        }
      }
    })

    // Relay events from API routes to targeted user (butuh token)
    socket.on('affiliate:event', (data: { userId: string; event: string; payload: any; token?: string }) => {
      if (!relayAuthorized(data)) {
        console.warn(`[affiliate-ws] ⛔ Relay "affiliate:event" ditolak (${AUTH_TOKEN ? 'token salah' : 'AFFILIATE_WS_TOKEN belum diset'})`)
        return
      }
      const { userId, event, payload } = data
      if (!userId || !event) return
      io.to(`user:${userId}`).emit(event, payload)
      console.log(`[affiliate-ws] Event "${event}" sent to user:${userId}`)
    })

    // Broadcast to all clients in a room (butuh token)
    socket.on('affiliate:broadcast', (data: { room: string; event: string; payload: any; token?: string }) => {
      if (!relayAuthorized(data)) {
        console.warn(`[affiliate-ws] ⛔ Relay "affiliate:broadcast" ditolak (${AUTH_TOKEN ? 'token salah' : 'AFFILIATE_WS_TOKEN belum diset'})`)
        return
      }
      const { room, event, payload } = data
      io.to(room).emit(event, payload)
    })

    // Ping/pong for keepalive
    socket.on('ping', () => {
      socket.emit('pong')
    })

    socket.on('disconnect', () => {
      console.log(`[affiliate-ws] Client disconnected: ${socket.id}`)
      // Clean up client from all rooms
      for (const [userId, socketIds] of clients.entries()) {
        socketIds.delete(socket.id)
        if (socketIds.size === 0) {
          clients.delete(userId)
        }
      }
    })
  })
}

console.log(`🚀 [affiliate-ws] WebSocket server running on port ${PORT}`)

/* ─── DEV-KEEPER ────────────────────────────────────────────────────────────
   (laporan Bos: preview 502 — dev server mati & gak ada yang nyalain lagi)
   Proses mini-service ini di-spawn saat BOOT → persisten, gak ikut dibersih-
   kan sandbox antar perintah. Keeper di bawah memastikan Next.js dev server
   (port 3000) SELALU hidup: kalau port kosong → spawn `bun run dev` sebagai
   child proses persisten ini (log ke dev.log). Interval 45 dtk = self-healing
   kalau server crash kapan pun. */
const KEEPER_URL_HOST = '127.0.0.1'
const KEEPER_PORT = 3000
let keeperBusy = false

/* Cek hidup/mati via RAW TCP CONNECT — sengaja BUKAN fetch+AbortSignal:
   di Bun versi sandbox, TimeoutError-nya DOMException bisa lewat sebagai
   uncaught & nge-restart eval child (interval keeper ikut hilang). */
async function devServerAlive(): Promise<boolean> {
  try {
    const socket = await Bun.connect({
      hostname: KEEPER_URL_HOST,
      port: KEEPER_PORT,
      socket: {
        data() {},
        close() {},
        error() {},
      },
    })
    try { socket.end() } catch {}
    return true
  } catch {
    return false // connection refused / unreachable → server mati
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

async function ensureDevServer(reason: string): Promise<void> {
  if (keeperBusy) return
  keeperBusy = true
  try {
    if (await devServerAlive()) return
    console.log(`[dev-keeper] port 3000 mati (${reason}) → spawn bun run dev`)
    const proc = Bun.spawn(
      ['bash', '-lc', 'cd /home/z/my-project && exec bun run dev >> dev.log 2>&1'],
      { cwd: '/home/z/my-project', stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' },
    )
    proc.unref()
    // Grace period: kasih waktu server start + cegah spawn ganda dari tick
    // interval berikutnya selagi server masih compiling.
    await sleep(20_000)
  } catch (e) {
    console.warn('[dev-keeper] gagal spawn dev server:', e instanceof Error ? e.message : e)
  } finally {
    keeperBusy = false
  }
}

void ensureDevServer('startup/hot-reload')
if (!G.__devKeeperInterval) {
  G.__devKeeperInterval = setInterval(() => void ensureDevServer('interval-45s'), 45_000)
}

// Export for external use (when imported by other services)
export { io }
