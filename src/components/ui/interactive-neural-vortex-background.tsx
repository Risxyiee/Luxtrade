'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Lightning-on-Click Background — Canvas 2D (ULTRA LIGHT)
 *
 * Behavior:
 *   - Idle state: NO requestAnimationFrame loop running, canvas is empty.
 *     Zero CPU/GPU cost when user is not interacting. Perfect for perf.
 *   - On `pointerdown` anywhere on the page: spawn a lightning bolt at the
 *     click point. The bolt "follows" the cursor for ~650ms — jagged forks
 *     are drawn from the click origin to the current cursor position.
 *   - After the bolt expires, the RAF loop cancels itself and the canvas
 *     is cleared — back to idle.
 *   - Mobile: tap spawns a single burst at the tap point (no follow since
 *     there's no hover on touch).
 *
 * Why this is light:
 *   - No continuous animation loop. RAF only runs for ~650ms after a click.
 *   - No particle system, no spatial grid, no per-frame connection checks.
 *   - Bolt geometry is regenerated per frame but only ~12 segments.
 */

interface Bolt {
  /** Origin point of the strike (where user clicked) */
  ox: number
  oy: number
  /** Timestamp when the bolt was spawned */
  born: number
  /** Duration of the bolt in ms */
  life: number
  /** Seed for jagged noise so each bolt looks different */
  seed: number
}

const BOLT_LIFE_MS = 650
const BOLT_SEGMENTS = 14
const FORK_PROBABILITY = 0.35
const MAX_BOLTS = 3 // hard cap to prevent runaway if user spam-clicks

const InteractiveNeuralVortex = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boltsRef = useRef<Bolt[]>([])
  const pointerRef = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number | null>(null)
  const dprRef = useRef(1)

  /** Pseudo-random generator seeded per-bolt so jaggedness is stable per frame */
  const seededRand = useCallback((seed: number, i: number) => {
    const x = Math.sin(seed * 9999 + i * 17.13) * 43758.5453
    return x - Math.floor(x)
  }, [])

  /** Generate jagged points from (x1,y1) to (x2,y2) */
  const generateJaggedPath = useCallback(
    (x1: number, y1: number, x2: number, y2: number, seed: number, displacement: number) => {
      const points: { x: number; y: number }[] = [{ x: x1, y: y1 }]
      for (let i = 1; i < BOLT_SEGMENTS; i++) {
        const t = i / BOLT_SEGMENTS
        const baseX = x1 + (x2 - x1) * t
        const baseY = y1 + (y2 - y1) * t
        // Perpendicular offset for jaggedness
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = -dy / len
        const ny = dx / len
        const offset = (seededRand(seed, i) - 0.5) * 2 * displacement
        points.push({ x: baseX + nx * offset, y: baseY + ny * offset })
      }
      points.push({ x: x2, y: y2 })
      return points
    },
    [seededRand]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isMobile = window.innerWidth < 768

    const resize = () => {
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio, 2)
      dprRef.current = dpr
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Track cursor position (used as the "target" the lightning follows)
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX
      pointerRef.current.y = e.clientY
    }
    window.addEventListener('pointermove', onPointerMove)

    // Spawn a bolt on click/tap
    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX
      pointerRef.current.y = e.clientY

      const newBolt: Bolt = {
        ox: e.clientX,
        oy: e.clientY,
        born: performance.now(),
        life: BOLT_LIFE_MS,
        seed: Math.random() * 10000,
      }

      // Cap total active bolts to prevent memory growth from spam clicks
      const bolts = boltsRef.current
      bolts.push(newBolt)
      if (bolts.length > MAX_BOLTS) {
        bolts.splice(0, bolts.length - MAX_BOLTS)
      }

      // Start RAF loop if not already running
      if (animationRef.current === null) {
        animationRef.current = requestAnimationFrame(render)
      }
    }

    const render = (now: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      const bolts = boltsRef.current

      // Filter out expired bolts
      const alive: Bolt[] = []
      for (let i = 0; i < bolts.length; i++) {
        const age = now - bolts[i].born
        if (age < bolts[i].life) alive.push(bolts[i])
      }
      boltsRef.current = alive

      // Clear and redraw
      ctx.clearRect(0, 0, w, h)

      // Don't darken background — keep canvas transparent over page bg

      const targetX = pointerRef.current.x
      const targetY = pointerRef.current.y

      for (let i = 0; i < alive.length; i++) {
        const bolt = alive[i]
        const age = now - bolt.born
        const progress = age / bolt.life // 0 → 1
        // Fade out: full opacity for first 30%, then linear fade
        const alpha = progress < 0.3 ? 1 : 1 - (progress - 0.3) / 0.7

        // Target point moves with cursor (lightning "follows" cursor)
        // On mobile there's no hover, so target stays at origin (burst effect)
        const tx = isMobile ? bolt.ox : targetX
        const ty = isMobile ? bolt.oy : targetY

        // Main bolt path — displacement decreases as bolt ages (settles down)
        const displacement = 35 * (1 - progress * 0.5)
        const mainPath = generateJaggedPath(bolt.ox, bolt.oy, tx, ty, bolt.seed, displacement)

        // Draw main bolt with glow (multiple passes for bloom effect)
        // Pass 1: wide soft glow
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.25})`
        ctx.lineWidth = 8
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(mainPath[0].x, mainPath[0].y)
        for (let p = 1; p < mainPath.length; p++) {
          ctx.lineTo(mainPath[p].x, mainPath[p].y)
        }
        ctx.stroke()

        // Pass 2: medium glow
        ctx.strokeStyle = `rgba(196, 132, 252, ${alpha * 0.5})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(mainPath[0].x, mainPath[0].y)
        for (let p = 1; p < mainPath.length; p++) {
          ctx.lineTo(mainPath[p].x, mainPath[p].y)
        }
        ctx.stroke()

        // Pass 3: bright core
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(mainPath[0].x, mainPath[0].y)
        for (let p = 1; p < mainPath.length; p++) {
          ctx.lineTo(mainPath[p].x, mainPath[p].y)
        }
        ctx.stroke()

        // Forks — secondary branches off the main bolt
        const forkCount = 2
        for (let f = 0; f < forkCount; f++) {
          // Only spawn forks if probability check passes AND bolt is still fresh
          if (seededRand(bolt.seed, f * 100) > FORK_PROBABILITY) continue
          if (progress > 0.6) continue

          // Pick a point along the main path to branch from
          const branchIdx = Math.floor(seededRand(bolt.seed, f * 50 + 7) * (BOLT_SEGMENTS - 2)) + 1
          const branchPoint = mainPath[branchIdx]
          // Fork goes off in a random direction with limited length
          const forkLen = 40 + seededRand(bolt.seed, f * 30 + 3) * 60
          const forkAngle = seededRand(bolt.seed, f * 40 + 11) * Math.PI * 2
          const fx = branchPoint.x + Math.cos(forkAngle) * forkLen
          const fy = branchPoint.y + Math.sin(forkAngle) * forkLen

          const forkPath = generateJaggedPath(
            branchPoint.x,
            branchPoint.y,
            fx,
            fy,
            bolt.seed + f * 1000,
            displacement * 0.6
          )

          // Fork glow
          ctx.strokeStyle = `rgba(196, 132, 252, ${alpha * 0.3})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(forkPath[0].x, forkPath[0].y)
          for (let p = 1; p < forkPath.length; p++) {
            ctx.lineTo(forkPath[p].x, forkPath[p].y)
          }
          ctx.stroke()

          // Fork core
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(forkPath[0].x, forkPath[0].y)
          for (let p = 1; p < forkPath.length; p++) {
            ctx.lineTo(forkPath[p].x, forkPath[p].y)
          }
          ctx.stroke()
        }

        // Impact flash at origin (fades fast)
        const flashRadius = 30 * (1 - progress)
        if (flashRadius > 0) {
          const flashGrad = ctx.createRadialGradient(
            bolt.ox,
            bolt.oy,
            0,
            bolt.ox,
            bolt.oy,
            flashRadius
          )
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.4})`)
          flashGrad.addColorStop(0.5, `rgba(196, 132, 252, ${alpha * 0.2})`)
          flashGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
          ctx.fillStyle = flashGrad
          ctx.beginPath()
          ctx.arc(bolt.ox, bolt.oy, flashRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // Tip glow at cursor (where bolt is currently striking)
        if (!isMobile && progress < 0.8) {
          const tipRadius = 20 * (1 - progress)
          const tipGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, tipRadius)
          tipGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`)
          tipGrad.addColorStop(0.5, `rgba(196, 132, 252, ${alpha * 0.3})`)
          tipGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
          ctx.fillStyle = tipGrad
          ctx.beginPath()
          ctx.arc(tx, ty, tipRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Continue loop only if there are alive bolts; otherwise go idle
      if (alive.length > 0) {
        animationRef.current = requestAnimationFrame(render)
      } else {
        animationRef.current = null
      }
    }

    // Attach pointerdown AFTER render is defined (so closure can reference it)
    window.addEventListener('pointerdown', onPointerDown, { passive: true })

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [generateJaggedPath, seededRand])

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
