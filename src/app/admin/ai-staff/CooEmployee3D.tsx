'use client'
// ============================================================
// CooEmployee3D — karyawan AI "Bagas" (COO Jualan) dalam 3D.
// Scene Three.js murni (tanpa react-three-fiber) — dibangun dari
// primitif, gaya senada Kantor CEO. Tema: office malam + aksen
// emerald/gold (jualan = duit). Idle: bobbing, kedip, head-turn,
// koin emas melayang, chart di monitor naik-turun.
// pendingCount > 0 → Bagas MELAMBUINKAN tangan (manggil Bos ACC).
// Klik scene → Bagas salute + onPoke() callback.
// ============================================================
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface CooEmployee3DProps {
  pendingCount: number
  loading?: boolean
  onPoke?: () => void
}

export default function CooEmployee3D({ pendingCount, loading, onPoke }: CooEmployee3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef(pendingCount)
  const pokeRef = useRef(onPoke)

  useEffect(() => { pendingRef.current = pendingCount }, [pendingCount])
  useEffect(() => { pokeRef.current = onPoke }, [onPoke])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer / Scene / Camera ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.cursor = 'pointer'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    camera.position.set(0, 1.55, 3.55)
    camera.lookAt(0, 0.95, 0)

    // ── Lights (hangat + rim emerald) ──
    scene.add(new THREE.AmbientLight(0xaab2c8, 1.05))
    const key = new THREE.DirectionalLight(0xffe3b8, 1.35)
    key.position.set(-1.6, 2.6, 2.2)
    scene.add(key)
    const rim = new THREE.PointLight(0x10b981, 1.5, 8)
    rim.position.set(1.4, 2.0, -1.6)
    scene.add(rim)
    const gold = new THREE.PointLight(0xfbbf24, 1.1, 5)
    gold.position.set(0.85, 1.9, 0.6)
    scene.add(gold)

    // ── Materials (shared) ──
    const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.08, ...o })
    const mSuit = M(0x252a3a)
    const mShirt = M(0xe9ecf3)
    const mTie = M(0x10b981, { roughness: 0.4, emissive: 0x064e3b, emissiveIntensity: 0.35 })
    const mSkin = M(0xf1c697)
    const mHair = M(0x241c12)
    const mDark = M(0x14171f)
    const mWood = M(0x4a3b2d)
    const mWoodLeg = M(0x2b2118)
    const mScreen = new THREE.MeshStandardMaterial({ color: 0x06110c, roughness: 0.3, emissive: 0x0a2e1f, emissiveIntensity: 0.5 })
    const mBar = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.4 })
    const mGold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25, emissive: 0x7c5a0a, emissiveIntensity: 0.45 })
    const mWhite = M(0xffffff, { roughness: 0.35 })
    const mBlack = M(0x10131a, { roughness: 0.3 })

    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      return mesh
    }
    const sph = (r: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 22) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m)
      mesh.position.set(x, y, z)
      return mesh
    }
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 20) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)
      mesh.position.set(x, y, z)
      return mesh
    }

    // ── Lantai (lingkaran gelap + ring emerald tipis) ──
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), M(0x0c101b, { roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.95, 2.02, 48),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.002
    scene.add(ring)

    // ══ RAKA — karakter COO ══
    const raka = new THREE.Group()
    scene.add(raka)
    raka.position.set(0, 0, -0.28)

    // badan (jas)
    const body = cyl(0.3, 0.42, 0.78, mSuit, 0, 0.82, 0)
    raka.add(body)
    // kemeja + dasi (jualan wajib pake dasi 😎)
    raka.add(box(0.15, 0.3, 0.02, mShirt, 0, 1.02, 0.395))
    const tie = box(0.07, 0.34, 0.028, mTie, 0, 0.99, 0.405)
    raka.add(tie)
    // kerah
    raka.add(box(0.24, 0.05, 0.02, mShirt, 0, 1.17, 0.39))
    // kepala
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 1.46, 0)
    raka.add(headGroup)
    headGroup.add(sph(0.26, mSkin, 0, 0, 0))
    // rambut (setengah bola)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.268, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), mHair)
    hair.position.set(0, 0.012, 0)
    headGroup.add(hair)
    // mata + pupil (kena animasi kedip)
    const eyeL = sph(0.045, mWhite, -0.09, 0.02, 0.225)
    const eyeR = sph(0.045, mWhite, 0.09, 0.02, 0.225)
    headGroup.add(eyeL, eyeR)
    headGroup.add(sph(0.021, mBlack, -0.09, 0.02, 0.262))
    headGroup.add(sph(0.021, mBlack, 0.09, 0.02, 0.262))
    // mulut senyum tipis
    const mouth = box(0.09, 0.014, 0.01, mHair, 0, -0.085, 0.245)
    headGroup.add(mouth)
    // kacamata (COO look cerdas) — frame tipis
    const glassBar = box(0.235, 0.012, 0.008, mBlack, 0, 0.038, 0.262)
    headGroup.add(glassBar)

    // lengan kiri (diam santai)
    const armL = cyl(0.065, 0.07, 0.52, mSuit, -0.4, 0.88, 0.05)
    armL.rotation.z = 0.32
    raka.add(armL)
    raka.add(sph(0.06, mSkin, -0.51, 0.63, 0.05))
    // lengan kanan — pivot di bahu, buat lambaian
    const armRGroup = new THREE.Group()
    armRGroup.position.set(0.4, 1.08, 0.02)
    const armR = cyl(0.065, 0.07, 0.52, mSuit, 0, -0.26, 0)
    armRGroup.add(armR)
    armRGroup.add(sph(0.06, mSkin, 0, -0.52, 0))
    raka.add(armRGroup)

    // ══ Meja kerja ══
    const desk = new THREE.Group()
    scene.add(desk)
    desk.add(box(1.55, 0.09, 0.68, mWood, 0, 0.78, 0.52))
    const legPos: [number, number][] = [[-0.68, 0.28], [0.68, 0.28], [-0.68, 0.76], [0.68, 0.76]]
    for (const [lx, lz] of legPos) desk.add(box(0.07, 0.74, 0.07, mWoodLeg, lx, 0.37, lz))

    // monitor + chart bars hijau (jualan naik 📈)
    const mon = new THREE.Group()
    mon.position.set(-0.18, 0, 0.34)
    desk.add(mon)
    mon.add(box(0.56, 0.4, 0.045, mDark, 0, 1.12, 0))
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), mScreen)
    screen.position.set(0, 1.12, 0.024)
    mon.add(screen)
    // 6 bar chart — scale.y dianimasikan
    const bars: THREE.Mesh[] = []
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.012), mBar)
      b.position.set(-0.19 + i * 0.075, -0.1, 0.035)
      b.geometry.translate(0, 0.1, 0) // pivot bawah → tumbuh ke atas
      mon.add(b)
      bars.push(b)
    }
    // kaki monitor
    mon.add(box(0.1, 0.16, 0.05, mDark, 0, 0.9, 0))
    mon.add(box(0.26, 0.02, 0.14, mDark, 0, 0.83, 0))
    // LED status monitor
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    )
    led.position.set(0.2, 0.945, 0.028)
    mon.add(led)
    // mug kopi
    desk.add(cyl(0.05, 0.045, 0.09, M(0x7c4a2d), 0.45, 0.87, 0.42))

    // ══ Koin emas melayang 💰 ══
    const coinGroup = new THREE.Group()
    coinGroup.position.set(0.88, 1.62, 0.18)
    scene.add(coinGroup)
    const coin = cyl(0.13, 0.13, 0.032, mGold, 0, 0, 0, 28)
    coin.rotation.x = Math.PI / 2
    coinGroup.add(coin)
    const coinEdge = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 10, 28), mGold)
    coinGroup.add(coinEdge)

    // ── Resize ──
    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // ── Poke (klik) → salute 2 detik ──
    let saluteUntil = 0
    const onClick = () => {
      saluteUntil = performance.now() + 2000
      pokeRef.current?.()
    }
    renderer.domElement.addEventListener('click', onClick)

    // ── Animasi loop ──
    let raf = 0
    let nextBlink = performance.now() + 3200
    let blinkUntil = 0
    const clock = new THREE.Clock()

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const now = performance.now()

      // idle bob + napas
      raka.position.y = Math.sin(t * 1.9) * 0.022
      tie.rotation.z = Math.sin(t * 2.4) * 0.05
      // kepala melirik sekitar
      headGroup.rotation.y = Math.sin(t * 0.65) * 0.16
      headGroup.rotation.z = Math.sin(t * 0.9) * 0.03

      // kedip
      if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2800 + Math.random() * 2400 }
      const blink = now < blinkUntil ? 0.12 : 1
      eyeL.scale.y = blink
      eyeR.scale.y = blink

      // lengan kanan: melambai kalau ada yang nunggu ACC / saat salute
      const saluting = now < saluteUntil
      if (saluting) {
        armRGroup.rotation.z = -2.35 + Math.sin(t * 10) * 0.28
      } else if (pendingRef.current > 0) {
        armRGroup.rotation.z = -2.2 + Math.sin(t * 4.2) * 0.22
      } else {
        armRGroup.rotation.z = -0.18 + Math.sin(t * 1.6) * 0.06
      }

      // koin emas: melayang + spin
      coinGroup.rotation.y = t * 1.6
      coinGroup.position.y = 1.62 + Math.sin(t * 2.1) * 0.07

      // chart bars naik-turun (sales chart hidup)
      for (let i = 0; i < bars.length; i++) {
        const s = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.1 + i * 0.9))
        bars[i].scale.y = s
      }
      bars[5].scale.y = 0.85 + 0.15 * Math.abs(Math.sin(t * 1.4)) // bar terakhir selalu tinggi

      renderer.render(scene, camera)
    }
    animate()

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('click', onClick)
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(m => m.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-white/5 bg-gradient-to-b from-[#0a0e18] to-[#070a11]">
      <div ref={mountRef} className="absolute inset-0" aria-label="Karyawan AI COO dalam 3D" role="img" />
      {/* Vignette lembut */}
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]" />
      {/* Nama + peran */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-[#070a12]/85 backdrop-blur px-2.5 py-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/40 bg-[#05070d]">
          <span className="text-xs">💼</span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-white leading-tight">Bagas — COO Jualan</span>
          <span className="block text-[10px] text-gray-500 leading-tight">Harian · 08.00 WIB · hotspot: free user paling rajin</span>
        </span>
      </div>
      {loading && (
        <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-gray-400">
          <RefreshSpinner /> cek antrean
        </div>
      )}
    </div>
  )
}

function RefreshSpinner() {
  return (
    <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.2-8.56" strokeLinecap="round" />
    </svg>
  )
}
