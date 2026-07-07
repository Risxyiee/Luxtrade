'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  hue: number
  life: number
  maxLife: number
}

// ──── Config ────
const PARTICLE_COUNT = 80
const CONNECTION_DISTANCE = 160
const MOUSE_RADIUS = 180
const VORTEX_STRENGTH = 0.0004
const MOUSE_ATTRACT = 0.02

// ──── Colors: purple ↔ amber with blue accents ────
const HUE_MIN = 260  // purple
const HUE_MAX = 38   // amber/gold

function randomHue(): number {
  // 70% chance purple range (250-290), 30% chance amber/gold (25-50)
  return Math.random() < 0.7
    ? 250 + Math.random() * 40
    : 25 + Math.random() * 25
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export default function InteractiveNeuralVortex() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000, active: false })
  const rafRef = useRef<number>(0)
  const timeRef = useRef(0)

  const createParticle = useCallback((w: number, h: number): Particle => {
    const edge = Math.random()
    let x: number, y: number
    if (edge < 0.25) { x = Math.random() * w; y = -10 }
    else if (edge < 0.5) { x = Math.random() * w; y = h + 10 }
    else if (edge < 0.75) { x = -10; y = Math.random() * h }
    else { x = w + 10; y = Math.random() * h }

    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: 1 + Math.random() * 2.2,
      opacity: 0,
      hue: randomHue(),
      life: 0,
      maxLife: 400 + Math.random() * 600,
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles spread across the screen
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle(w, h)
      // Spread initial positions across the viewport
      p.x = Math.random() * w
      p.y = Math.random() * h
      p.life = Math.random() * p.maxLife * 0.5 // stagger fade-in
      p.opacity = 0.3 + Math.random() * 0.5
      particlesRef.current.push(p)
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true }
    }
    const onMouseLeave = () => {
      mouseRef.current.active = false
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true }
      }
    }
    const onTouchEnd = () => {
      mouseRef.current.active = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    // ──── Animation Loop ────
    const animate = () => {
      timeRef.current++
      const t = timeRef.current
      const cx = w / 2
      const cy = h / 2
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const mouseActive = mouseRef.current.active

      ctx.clearRect(0, 0, w, h)

      const particles = particlesRef.current

      // ──── Update & Draw Particles ────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Vortex force toward center (subtle spiral)
        const dx = cx - p.x
        const dy = cy - p.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const angle = Math.atan2(dy, dx) + Math.PI / 2 // perpendicular = spiral
        const vortexForce = VORTEX_STRENGTH * Math.min(d, 400)
        p.vx += Math.cos(angle) * vortexForce * d
        p.vy += Math.sin(angle) * vortexForce * d

        // Slight pull toward center to prevent escape
        p.vx += dx * 0.00003
        p.vy += dy * 0.00003

        // Mouse interaction
        if (mouseActive) {
          const mdx = mx - p.x
          const mdy = my - p.y
          const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
          if (md < MOUSE_RADIUS) {
            const force = (1 - md / MOUSE_RADIUS) * MOUSE_ATTRACT
            p.vx += mdx / md * force
            p.vy += mdy / md * force
            // Boost opacity near mouse
            p.opacity = Math.min(1, p.opacity + 0.02)
          }
        }

        // Damping
        p.vx *= 0.995
        p.vy *= 0.995

        // Move
        p.x += p.vx
        p.y += p.vy

        // Life cycle
        p.life++
        if (p.life < 60) {
          p.opacity = Math.min(p.opacity + 0.008, 0.6 + Math.random() * 0.2)
        } else if (p.life > p.maxLife - 80) {
          p.opacity = Math.max(0, p.opacity - 0.008)
        }

        // Respawn if dead or out of bounds (with margin)
        if (p.life >= p.maxLife || p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > h + 100) {
          const np = createParticle(w, h)
          particles[i] = np
        }

        // ──── Draw particle with glow ────
        const glowRadius = p.radius * 3
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
        const hue = p.hue
        gradient.addColorStop(0, `hsla(${hue}, 80%, 65%, ${p.opacity * 0.8})`)
        gradient.addColorStop(0.4, `hsla(${hue}, 70%, 55%, ${p.opacity * 0.3})`)
        gradient.addColorStop(1, `hsla(${hue}, 60%, 50%, 0)`)

        ctx.beginPath()
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Core bright dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, ${p.opacity})`
        ctx.fill()
      }

      // ──── Draw Neural Connections ────
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const d = dist(a.x, a.y, b.x, b.y)
          if (d < CONNECTION_DISTANCE) {
            const alpha = (1 - d / CONNECTION_DISTANCE) * 0.25 * Math.min(a.opacity, b.opacity)
            if (alpha < 0.01) continue

            // Blend hues
            const midHue = (a.hue + b.hue) / 2
            ctx.strokeStyle = `hsla(${midHue}, 60%, 60%, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()

            // Draw a tiny "node" at midpoint for neural feel (sparse)
            if (d < CONNECTION_DISTANCE * 0.4 && Math.random() < 0.15) {
              const mx2 = (a.x + b.x) / 2
              const my2 = (a.y + b.y) / 2
              ctx.beginPath()
              ctx.arc(mx2, my2, 0.8, 0, Math.PI * 2)
              ctx.fillStyle = `hsla(${midHue}, 80%, 70%, ${alpha * 2})`
              ctx.fill()
            }
          }
        }
      }

      // ──── Mouse glow ────
      if (mouseActive) {
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS)
        mg.addColorStop(0, `hsla(270, 80%, 60%, 0.06)`)
        mg.addColorStop(0.5, `hsla(270, 60%, 50%, 0.02)`)
        mg.addColorStop(1, `hsla(270, 40%, 50%, 0)`)
        ctx.beginPath()
        ctx.arc(mx, my, MOUSE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = mg
        ctx.fill()
      }

      // ──── Subtle center vortex glow ────
      const pulse = Math.sin(t * 0.008) * 0.3 + 0.7
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.35)
      cg.addColorStop(0, `hsla(270, 50%, 40%, ${0.03 * pulse})`)
      cg.addColorStop(0.5, `hsla(280, 40%, 30%, ${0.01 * pulse})`)
      cg.addColorStop(1, `hsla(260, 30%, 20%, 0)`)
      ctx.beginPath()
      ctx.arc(cx, cy, Math.min(w, h) * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = cg
      ctx.fill()

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [createParticle])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  )
}