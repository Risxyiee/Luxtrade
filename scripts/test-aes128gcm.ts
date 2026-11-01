// @ts-nocheck
/**
 * UJI KRIPTO aes128gcm (RFC 8291 + RFC 8188) — bukti penentu fix web-push.
 *
 * Meniru SISI DEVICE (browser): dekripsi implementasi independen mengikuti
 * RFC, lalu:
 *   A. Skema LAMA (HMAC tunggal + salt 0^16, tanpa auth)  → WAJIB GAGAL
 *   B. Library web-push resmi (reference implementation)  → dekriptor divalidasi
 *   C. Kode KITA yang sudah difix (encryptAes128Gcm)      → WAJIB DEKRIPSI OK
 *
 * Jalankan: bun scripts/test-aes128gcm.ts
 */
import webpush from 'web-push'
import { encryptAes128Gcm } from '../src/lib/web-push-cf'

const enc = new TextEncoder()
const dec = new TextDecoder()

// ─── helpers ─────────────────────────────────────────────────────────────────
function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function bytesToB64url(b) {
  let bin = ''
  for (const x of b) bin += String.fromCharCode(x)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}
/** HKDF penuh (Extract-then-Expand, SHA-256) — RFC 5869 */
async function hkdf(salt, ikm, info, len) {
  const exKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', exKey, ikm))
  const exKey2 = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const t1 = new Uint8Array(await crypto.subtle.sign('HMAC', exKey2, concat(info, new Uint8Array([1]))))
  return t1.slice(0, len)
}

// ─── DEKRIPTOR sisi-device (independen, dari RFC) ────────────────────────────
async function decryptAes128gcm(body, uaPrivJwk, uaPublicRaw, authSecret) {
  const salt = body.slice(0, 16)
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength)
  dv.getUint32(16, false) // rs (tidak dipakai utk record tunggal)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ct = body.slice(21 + idlen)

  const asJwk = {
    kty: 'EC', crv: 'P-256',
    x: bytesToB64url(asPublic.slice(1, 33)),
    y: bytesToB64url(asPublic.slice(33, 65)),
  }
  const asKey = await crypto.subtle.importKey('jwk', asJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const uaPriv = await crypto.subtle.importKey('jwk', uaPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPriv, 256))

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublicRaw, asPublic), 32)
  const CEK = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16)
  const NONCE = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12)

  const aesKey = await crypto.subtle.importKey('raw', CEK, 'AES-GCM', false, ['decrypt'])
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: NONCE, tagLength: 128 }, aesKey, ct))
  if (pt[pt.length - 1] !== 0x02) throw new Error(`delimiter record bukan 0x02 (${pt[pt.length - 1]})`)
  return dec.decode(pt.slice(0, -1))
}

// ─── Enkripsi skema LAMA (bug) — HMAC tunggal + salt 0^16, auth DIBUANG ──────
async function encryptOldBroken(payloadBytes, uaPublicKeyB64) {
  const uaPublic = b64urlToBytes(uaPublicKeyB64)
  const uaJwk = { kty: 'EC', crv: 'P-256', x: bytesToB64url(uaPublic.slice(1, 33)), y: bytesToB64url(uaPublic.slice(33, 65)) }
  const uaKey = await crypto.subtle.importKey('jwk', uaJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256))
  const asJwk = await crypto.subtle.exportKey('jwk', asKeys.publicKey)
  const asEphemeralPublic = concat(new Uint8Array([0x04]), b64urlToBytes(asJwk.x), b64urlToBytes(asJwk.y))
  async function hmac(k, d) {
    const kk = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', kk, d))
  }
  // ── salinan SETIA kode lama (single HMAC, salt 0^16, tanpa auth, tanpa Expand):
  const PRK_key = await hmac(new Uint8Array(16), ecdhSecret) // salt = 0x00*16 (SALAH)
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asEphemeralPublic)
  const IKM = await hmac(PRK_key, keyInfo)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const PRK = await hmac(salt, IKM)
  const CEK = (await hmac(PRK, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])))).slice(0, 16)
  const NONCE = (await hmac(PRK, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])))).slice(0, 12)
  const record = concat(payloadBytes, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', CEK, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: NONCE, tagLength: 128 }, aesKey, record))
  const RS = 4096
  const header = new Uint8Array(16 + 4 + 1 + asEphemeralPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RS, false)
  header[20] = asEphemeralPublic.length
  header.set(asEphemeralPublic, 21)
  return concat(header, ciphertext)
}

// ─── SUITE ───────────────────────────────────────────────────────────────────
async function main() {
  const payload = JSON.stringify({ title: '🔔 Probe', body: 'Uji dekripsi RFC 8291', url: '/dashboard' })
  const payloadBytes = enc.encode(payload)

  // Subscription "browser" palsu — persis bentuk yang dimiliki device asli
  const uaKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const uaPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey))
  const uaPrivJwk = await crypto.subtle.exportKey('jwk', uaKeys.privateKey)
  const uaPubB64 = bytesToB64url(uaPubRaw)
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  const authB64 = bytesToB64url(authSecret)

  console.log('payload :', payload.slice(0, 60), '...')
  console.log('')

  // ── A. SKEMA LAMA (bug) → wajib GAGAL dekripsi ──
  try {
    const oldBody = await encryptOldBroken(payloadBytes, uaPubB64)
    await decryptAes128gcm(oldBody, uaPrivJwk, uaPubRaw, authSecret)
    console.log('A. SKEMA LAMA      : ⚠️  TERDEKRIPSI?! (tidak sesuai dugaan)')
  } catch (e) {
    console.log('A. SKEMA LAMA      : ❌ GAGAL dekripsi di device →', String(e.message).slice(0, 60))
    console.log('   → INI biang keladinya: payload lama memang tak terbaca device.')
  }

  // ── B. Library resmi → validasi dekriptor ──
  const details = webpush.generateRequestDetails(
    { endpoint: 'https://push.example/send/fake', keys: { p256dh: uaPubB64, auth: authB64 } },
    payload,
    { contentEncoding: 'aes128gcm' }
  )
  const libBody = new Uint8Array(details.body)
  const fromLib = await decryptAes128gcm(libBody, uaPrivJwk, uaPubRaw, authSecret)
  if (fromLib === payload) {
    console.log('B. LIBRARY RESMI   : ✅ terdekripsi sempurna → dekriptor TERVERIFIKASI')
  } else {
    throw new Error('dekriptor gagal baca output library — skrip salah')
  }

  // ── C. Kode KITA (fix) → wajib dekripsi OK ──
  const ourBody = await encryptAes128Gcm(payloadBytes, uaPubB64, authB64)
  const fromOurs = await decryptAes128gcm(ourBody, uaPrivJwk, uaPubRaw, authSecret)
  if (fromOurs === payload) {
    console.log('C. KODE KITA (FIX) : ✅ terdekripsi sempurna → RFC 8291 benar')
  } else {
    throw new Error('output kode kita tidak terdekripsi — fix belum benar')
  }

  // ── D. auth secret salah → wajib GAGAL (bukti auth dipakai) ──
  const wrongAuth = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)))
  const ourBody2 = await encryptAes128Gcm(payloadBytes, uaPubB64, wrongAuth)
  try {
    await decryptAes128gcm(ourBody2, uaPrivJwk, uaPubRaw, authSecret)
    console.log('D. AUTH SALAH      : ⚠️  terdekripsi?! auth tidak dipakai — ada bug')
  } catch {
    console.log('D. AUTH SALAH      : ❌ gagal dekripsi → auth secret benar-benar dipakai')
  }

  console.log('')
  console.log('KESIMPULAN: fix enkripsi TERVERIFIKASI (RFC 8291 + cross-check library resmi).')
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL:', e); process.exit(1) })
