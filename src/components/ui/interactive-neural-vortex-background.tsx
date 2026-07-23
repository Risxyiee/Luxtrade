'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Interactive Neural Mesh Background — Canvas 2D (OPTIMIZED)
 * Reduced particles, spatial grid for O(n) connections, visibility-based throttling.
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

const CONNECTION_DISTANCE = 150
const MOUSE_RADIUS = 200
const PARTICLE_COUNT_DESKTOP = 60
const PARTICLE_COUNT_MOBILE = 30
const CELL_SIZE = CONNECTION_DISTANCE
const NODE_COLORS = [
  { r: 148, g: 80, b: 235 },
  { r: 59, g: 210, b: 228 },
  { r: 168, g: 85, b: 247 },
]

const InteractiveNeuralVortex = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({ x: -9999, y: -9999 })
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const visibleRef = useRef(true)

  const createParticles = useCallback((width: number, height: number, count: number): Particle[] => {
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      const colorDef = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)]
      const baseRadius = 1 + Math.random() * 2
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
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

    const resize = () => {
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particlesRef.current = createParticles(w, h, particleCount)
    }
    resize()
    window.addEventListener('resize', resize)

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

    // Visibility detection — skip rendering when tab is hidden
    const onVisibilityChange = () => { visibleRef.current = !document.hidden }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Spatial grid for O(n) neighbor lookup
    let gridCols = 0
    let gridRows = 0
    const buildGrid = (w: number, h: number, particles: Particle[]): Map<string, number[]> => {
      gridCols = Math.max(1, Math.ceil(w / CELL_SIZE))
      gridRows = Math.max(1, Math.ceil(h / CELL_SIZE))
      const grid = new Map<string, number[]>()
      for (let i = 0; i < particles.length; i++) {
        const col = Math.floor(particles[i].x / CELL_SIZE)
        const row = Math.floor(particles[i].y / CELL_SIZE)
        const key = `${Math.max(0, Math.min(col, gridCols - 1))},${Math.max(0, Math.min(row, gridRows - 1))}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key)!.push(i)
      }
      return grid
    }

    let lastFrame = 0
    const render = (now: number) => {
      animationRef.current = requestAnimationFrame(render)

      // Skip when tab is hidden
      if (!visibleRef.current) return

      // Throttle: ~30fps desktop, ~20fps mobile
      const minInterval = isMobile ? 50 : 33
      if (now - lastFrame < minInterval) return
      lastFrame = now

      const w = window.innerWidth
      const h = window.innerHeight
      const particles = particlesRef.current
      const mx = pointer.current.x
      const my = pointer.current.y

      ctx.clearRect(0, 0, w, h)

      // Update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.vx += (Math.random() - 0.5) * 0.015
        p.vy += (Math.random() - 0.5) * 0.015
        p.vx *= 0.99
        p.vy *= 0.99

        const dxMouse = mx - p.x
        const dyMouse = my - p.y
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse)
        if (distMouse < MOUSE_RADIUS && distMouse > 1) {
          const force = (1 - distMouse / MOUSE_RADIUS) * 0.005
          p.vx += dxMouse * force
          p.vy += dyMouse * force
          p.radius = p.baseRadius * (1 + (1 - distMouse / MOUSE_RADIUS) * 1.2)
        } else {
          p.radius += (p.baseRadius - p.radius) * 0.05
        }

        p.x += p.vx
        p.y += p.vy

        const pad = 20
        if (p.x < -pad) p.x = w + pad
        if (p.x > w + pad) p.x = -pad
        if (p.y < -pad) p.y = h + pad
        if (p.y > h + pad) p.y = -pad
      }

      // Draw connections using spatial grid
      const grid = buildGrid(w, h, particles)
      ctx.lineWidth = 0.5
      const connected = new Set<string>()

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        const col = Math.floor(a.x / CELL_SIZE)
        const row = Math.floor(a.y / CELL_SIZE)

        // Check 3x3 neighborhood
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const key = `${Math.max(0, Math.min(col + dc, gridCols - 1))},${Math.max(0, Math.min(row + dr, gridRows - 1))}`
            const cell = grid.get(key)
            if (!cell) continue
            for (let ci = 0; ci < cell.length; ci++) {
              const j = cell[ci]
              if (j <= i) continue
              const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`
              if (connected.has(pairKey)) continue

              const b = particles[j]
              const dx = a.x - b.x
              const dy = a.y - b.y
              const dist = Math.sqrt(dx * dx + dy * dy)

              if (dist < CONNECTION_DISTANCE) {
                connected.add(pairKey)
                const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.3
                ctx.strokeStyle = `rgba(148, 120, 240, ${alpha})`
                ctx.beginPath()
                ctx.moveTo(a.x, a.y)
                ctx.lineTo(b.x, b.y)
                ctx.stroke()
              }
            }
          }
        }
      }

      // Draw nodes (simplified: 2 draws instead of 4)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dxM = mx - p.x
        const dyM = my - p.y
        const distM = Math.sqrt(dxM * dxM + dyM * dyM)
        const proximity = distM < MOUSE_RADIUS ? 1 - distM / MOUSE_RADIUS : 0

        // Glow
        const glowRadius = p.radius * (2 + proximity * 1.5)
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.05 + proximity * 0.1) + ')'
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color + (0.5 + proximity * 0.5) + ')'
        ctx.fill()
      }
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
