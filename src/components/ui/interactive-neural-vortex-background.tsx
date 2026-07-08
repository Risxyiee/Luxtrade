'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Interactive Neural Mesh Background — Canvas 2D
 * Distributed nodes with connection lines, mouse proximity interaction.
 * Reference: 21st.dev/@thanh/components/interactive-neural-vortex-background
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseRadius: number
  color: string
}

const CONNECTION_DISTANCE = 200
const MOUSE_RADIUS = 250
const PARTICLE_COUNT_DESKTOP = 130
const PARTICLE_COUNT_MOBILE = 60
const NODE_COLORS = [
  { r: 148, g: 80, b: 235 },   // purple
  { r: 59, g: 210, b: 228 },    // cyan
  { r: 168, g: 85, b: 247 },    // violet
  { r: 99, g: 200, b: 240 },    // light cyan
  { r: 139, g: 92, b: 246 },    // indigo-violet
]

const InteractiveNeuralVortex = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({ x: -9999, y: -9999 })
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  const createParticles = useCallback((width: number, height: number, count: number): Particle[] => {
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      const colorDef = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)]
      const baseRadius = 1.2 + Math.random() * 2.5
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: baseRadius,
        baseRadius,
        color: `rgba(${colorDef.r}, ${colorDef.g}, ${colorDef.b}, `,
      })
    }
    return particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isMobile = window.innerWidth < 768
    const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP

    // ──── Canvas sizing ────
    const resize = () => {
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Re-create particles on resize to fill new area
      particlesRef.current = createParticles(w, h, particleCount)
    }
    resize()
    window.addEventListener('resize', resize)

    // ──── Pointer events ────
    const onPointerMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX
      pointer.current.y = e.clientY
    }
    const onPointerLeave = () => {
      pointer.current.x = -9999
      pointer.current.y = -9999
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)

    // ──── Render loop ────
    let lastFrame = 0
    const render = (now: number) => {
      // Throttle on mobile
      if (isMobile && now - lastFrame < 50) {
        animationRef.current = requestAnimationFrame(render)
        return
      }
      lastFrame = now

      const w = window.innerWidth
      const h = window.innerHeight
      const particles = particlesRef.current
      const mx = pointer.current.x
      const my = pointer.current.y

      // Clear
      ctx.clearRect(0, 0, w, h)

      // ──── Update particles ────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Gentle random drift
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.02

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        // Mouse attraction (gentle pull)
        const dxMouse = mx - p.x
        const dyMouse = my - p.y
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)
        if (distMouse < MOUSE_RADIUS && distMouse > 1) {
          const force = (1 - distMouse / MOUSE_RADIUS) * 0.008
          p.vx += dxMouse * force
          p.vy += dyMouse * force
          // Enlarge near mouse
          p.radius = p.baseRadius * (1 + (1 - distMouse / MOUSE_RADIUS) * 1.5)
        } else {
          p.radius += (p.baseRadius - p.radius) * 0.05
        }

        // Move
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges with padding
        const pad = 20
        if (p.x < -pad) p.x = w + pad
        if (p.x > w + pad) p.x = -pad
        if (p.y < -pad) p.y = h + pad
        if (p.y > h + pad) p.y = -pad
      }

      // ──── Draw connections ────
      ctx.lineWidth = 0.6
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE)

            // Brighten connections near mouse
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const dxM = mx - midX
            const dyM = my - midY
            const distM = Math.sqrt(dxM * dxM + dyM * dyM)
            const mouseBoost = distM < MOUSE_RADIUS ? (1 - distM / MOUSE_RADIUS) * 0.5 : 0

            const finalAlpha = Math.min(1, alpha * 0.35 + mouseBoost)
            ctx.strokeStyle = `rgba(148, 120, 240, ${finalAlpha})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // ──── Draw nodes (concentric filled circles for visibility) ────
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse proximity brightness
        const dxM = mx - p.x
        const dyM = my - p.y
        const distM = Math.sqrt(dxM * dxM + dyM * dyM)
        const proximity = distM < MOUSE_RADIUS ? 1 - distM / MOUSE_RADIUS : 0

        // Outer glow
        const glowRadius = p.radius * (2.5 + proximity * 2)
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.06 + proximity * 0.12) + ')'
        ctx.fill()

        // Mid ring
        const midRadius = p.radius * (1.6 + proximity)
        ctx.beginPath()
        ctx.arc(p.x, p.y, midRadius, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.15 + proximity * 0.25) + ')'
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.6 + proximity * 0.4) + ')'
        ctx.fill()

        // Bright center dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.9 + proximity * 0.1) + ')'
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    // ──── Cleanup ────
    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [createParticles])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}

export default InteractiveNeuralVortex