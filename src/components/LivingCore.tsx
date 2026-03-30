'use client'
import { useEffect, useRef } from 'react'

interface LivingCoreProps { className?: string }

const COLORS = { blue: '#3b82f6', cyan: '#22d3ee', violet: '#8b5cf6' }

function rgba(hex: string, a: number): string {
  const v = (s: number, e: number) => parseInt(hex.slice(s, e), 16)
  return `rgba(${v(1,3)},${v(3,5)},${v(5,7)},${a})`
}

interface Node { x: number; y: number; vx: number; vy: number; phase: number; color: string; size: number; layer: number }
interface Pulse { fromIdx: number; toIdx: number; t: number; speed: number; color: string }

function buildNetwork(): Node[] {
  const nodes: Node[] = []
  // Central core node
  nodes.push({ x: 0.5, y: 0.5, vx: 0, vy: 0, phase: 0, color: COLORS.cyan, size: 1.8, layer: 0 })
  // Inner ring — 6 nodes
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3
    const r = 0.16 + (Math.random() - 0.5) * 0.02
    nodes.push({
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.000015,
      vy: (Math.random() - 0.5) * 0.000015,
      phase: Math.random() * Math.PI * 2,
      color: i % 2 === 0 ? COLORS.blue : COLORS.cyan,
      size: 1.2,
      layer: 1,
    })
  }
  // Middle ring — 9 nodes
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + 0.7
    const r = 0.28 + (Math.random() - 0.5) * 0.03
    nodes.push({
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.00001,
      vy: (Math.random() - 0.5) * 0.00001,
      phase: Math.random() * Math.PI * 2,
      color: i % 3 === 0 ? COLORS.violet : i % 3 === 1 ? COLORS.blue : COLORS.cyan,
      size: 1.0,
      layer: 2,
    })
  }
  // Outer ring — 12 nodes
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 1.1
    const r = 0.38 + (Math.random() - 0.5) * 0.04
    nodes.push({
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.000008,
      vy: (Math.random() - 0.5) * 0.000008,
      phase: Math.random() * Math.PI * 2,
      color: i % 4 === 0 ? COLORS.violet : COLORS.blue,
      size: 0.8,
      layer: 3,
    })
  }
  return nodes
}

function buildEdges(nodes: Node[]): [number, number][] {
  const edges: [number, number][] = []
  // center -> all inner
  for (let i = 1; i <= 6; i++) edges.push([0, i])
  // inner -> middle (each inner connects to ~2 middle nodes)
  for (let i = 1; i <= 6; i++) {
    for (let j = 7; j <= 15; j++) {
      const a = nodes[i], b = nodes[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < 0.18) edges.push([i, j])
    }
  }
  // middle -> outer
  for (let i = 7; i <= 15; i++) {
    for (let j = 16; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < 0.16) edges.push([i, j])
    }
  }
  // adjacent inner ring connections
  for (let i = 1; i <= 6; i++) {
    const next = i === 6 ? 1 : i + 1
    edges.push([i, next])
  }
  return edges
}

export default function LivingCore({ className = '' }: LivingCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const nodes = buildNetwork()
    const edges = buildEdges(nodes)

    // Build pulses — one per edge, staggered
    const pulses: Pulse[] = edges.map((e, i) => ({
      fromIdx: e[0],
      toIdx: e[1],
      t: (i / edges.length),
      speed: 0.00018 + Math.random() * 0.00012,
      color: Math.random() < 0.4 ? COLORS.cyan : Math.random() < 0.6 ? COLORS.violet : COLORS.blue,
    }))

    let animFrame = 0
    let lastTime = performance.now()

    function draw(now: number) {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      const dpr = devicePixelRatio
      const w = canvas!.width / dpr
      const h = canvas!.height / dpr
      const s = Math.min(w, h)
      const cx = w / 2, cy = h / 2

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      // Background radial glow (subtle)
      const bgGlow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, s * 0.55)
      bgGlow.addColorStop(0, rgba(COLORS.blue, 0.06))
      bgGlow.addColorStop(0.5, rgba(COLORS.violet, 0.02))
      bgGlow.addColorStop(1, rgba(COLORS.blue, 0))
      ctx!.fillStyle = bgGlow
      ctx!.fillRect(0, 0, w, h)

      // Drift nodes slightly
      if (!prefersReduced) {
        for (const n of nodes) {
          if (n.layer === 0) continue // core doesn't drift
          const drift = Math.sin(now * 0.0004 + n.phase) * 0.000006
          n.x += (n.vx + drift) * dt
          n.y += (n.vy + drift * 0.8) * dt
          // Gentle home pull toward original position — approximate with center pull weighted by layer
          const homeR = n.layer === 1 ? 0.16 : n.layer === 2 ? 0.28 : 0.38
          const dist = Math.hypot(n.x - 0.5, n.y - 0.5)
          if (dist > homeR + 0.07) {
            n.x += (0.5 - n.x) * 0.00003 * dt
            n.y += (0.5 - n.y) * 0.00003 * dt
          }
        }
      }

      // Draw edges
      for (const [i, j] of edges) {
        const ax = nodes[i].x * w, ay = nodes[i].y * h
        const bx = nodes[j].x * w, by = nodes[j].y * h
        const dist = Math.hypot(ax - bx, ay - by)
        const maxDist = 0.35 * s
        const alpha = Math.max(0, 1 - dist / maxDist) * 0.18
        ctx!.beginPath()
        ctx!.moveTo(ax, ay)
        ctx!.lineTo(bx, by)
        ctx!.strokeStyle = rgba(COLORS.blue, alpha)
        ctx!.lineWidth = 0.6
        ctx!.stroke()
      }

      // Draw pulses
      if (!prefersReduced) {
        for (const p of pulses) {
          p.t += p.speed * dt
          if (p.t > 1) p.t -= 1
          const fn = nodes[p.fromIdx], tn = nodes[p.toIdx]
          const px = (fn.x + (tn.x - fn.x) * p.t) * w
          const py = (fn.y + (tn.y - fn.y) * p.t) * h
          const pr = Math.max(2, s * 0.004)
          const pg = ctx!.createRadialGradient(px, py, 0, px, py, pr * 2.5)
          pg.addColorStop(0, rgba(p.color, 0.7))
          pg.addColorStop(1, rgba(p.color, 0))
          ctx!.beginPath()
          ctx!.arc(px, py, pr * 2.5, 0, Math.PI * 2)
          ctx!.fillStyle = pg
          ctx!.fill()
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const nx = n.x * w, ny = n.y * h
        const pulse = prefersReduced ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0018 + n.phase)
        const baseR = Math.max(2, s * 0.005) * n.size

        // Outer glow
        const og = ctx!.createRadialGradient(nx, ny, 0, nx, ny, baseR * 5)
        og.addColorStop(0, rgba(n.color, 0.12 * pulse))
        og.addColorStop(1, rgba(n.color, 0))
        ctx!.beginPath()
        ctx!.arc(nx, ny, baseR * 5, 0, Math.PI * 2)
        ctx!.fillStyle = og
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(nx, ny, baseR, 0, Math.PI * 2)
        ctx!.fillStyle = rgba(n.color, 0.55 + 0.3 * pulse)
        ctx!.fill()
      }

      // Central breathing ring
      if (!prefersReduced) {
        const ringPulse = 0.5 + 0.5 * Math.sin(now * 0.0008)
        ctx!.beginPath()
        ctx!.arc(cx, cy, s * 0.04 * (1 + ringPulse * 0.3), 0, Math.PI * 2)
        ctx!.strokeStyle = rgba(COLORS.cyan, 0.15 * ringPulse)
        ctx!.lineWidth = 1
        ctx!.stroke()
      }

      animFrame = requestAnimationFrame(draw)
    }

    animFrame = requestAnimationFrame(draw)

    function syncSize() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const dpr = devicePixelRatio
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)

    return () => { cancelAnimationFrame(animFrame); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
