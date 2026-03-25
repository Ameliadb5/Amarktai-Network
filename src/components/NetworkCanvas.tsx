'use client'
import { useEffect, useRef } from 'react'

interface NetworkCanvasProps {
  className?: string
  interactive?: boolean
  activationStep?: number
}

interface Node {
  id: string
  label: string
  rx: number
  ry: number
  color: string
  glowColor: string
}

interface Edge {
  from: string
  to: string
  bidirectional?: boolean
}

interface Pulse {
  edgeIndex: number
  t: number
  speed: number
  reverse: boolean
}

const NODES: Node[] = [
  { id: 'request',  label: 'Request',         rx: 0.05, ry: 0.50, color: '#3b82f6', glowColor: '#60a5fa' },
  { id: 'intent',   label: 'Intent Engine',   rx: 0.22, ry: 0.32, color: '#06b6d4', glowColor: '#67e8f9' },
  { id: 'context',  label: 'Context Store',   rx: 0.22, ry: 0.68, color: '#14b8a6', glowColor: '#5eead4' },
  { id: 'router',   label: 'Decision Router', rx: 0.43, ry: 0.50, color: '#7c3aed', glowColor: '#a78bfa' },
  { id: 'layerA',   label: 'Layer α',         rx: 0.63, ry: 0.20, color: '#9333ea', glowColor: '#d8b4fe' },
  { id: 'layerB',   label: 'Layer β',         rx: 0.63, ry: 0.50, color: '#7c3aed', glowColor: '#a78bfa' },
  { id: 'layerC',   label: 'Layer γ',         rx: 0.63, ry: 0.80, color: '#4f46e5', glowColor: '#a5b4fc' },
  { id: 'merge',    label: 'Merge Engine',    rx: 0.80, ry: 0.50, color: '#06b6d4', glowColor: '#67e8f9' },
  { id: 'result',   label: 'Result',          rx: 0.95, ry: 0.50, color: '#10b981', glowColor: '#6ee7b7' },
]

const EDGES: Edge[] = [
  { from: 'request', to: 'intent' },
  { from: 'intent',  to: 'router' },
  { from: 'request', to: 'context' },
  { from: 'context', to: 'router' },
  { from: 'router',  to: 'layerA' },
  { from: 'router',  to: 'layerB' },
  { from: 'router',  to: 'layerC' },
  { from: 'layerA',  to: 'merge' },
  { from: 'layerB',  to: 'merge' },
  { from: 'layerC',  to: 'merge' },
  { from: 'merge',   to: 'result' },
  { from: 'context', to: 'merge', bidirectional: true },
]

const ACTIVE_NODES_BY_STEP: Record<number, string[]> = {
  0: [],
  1: ['request', 'intent'],
  2: ['request', 'intent', 'context', 'router'],
  3: ['request', 'intent', 'context', 'router', 'layerA', 'layerB', 'layerC'],
  4: ['request', 'intent', 'context', 'router', 'layerA', 'layerB', 'layerC', 'merge'],
  5: ['request', 'intent', 'context', 'router', 'layerA', 'layerB', 'layerC', 'merge', 'result'],
}

const BASE_SPEED = 0.00035
const BIDIR_OFFSET = 1.5 // perpendicular pixel offset for bidirectional edge lanes

function nodeById(id: string): Node {
  const node = NODES.find(n => n.id === id)
  if (!node) throw new Error(`Unknown node id: "${id}"`)
  return node
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbStr(hex: string, alpha: number, brighten = 1): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.min(255, Math.round(r * brighten))},${Math.min(255, Math.round(g * brighten))},${Math.min(255, Math.round(b * brighten))},${alpha})`
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  size: number,
  color: string
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, -size * 0.5)
  ctx.lineTo(-size,  size * 0.5)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function makePulse(edgeIndex: number, reverse = false): Pulse {
  return {
    edgeIndex,
    t: 0,
    speed: BASE_SPEED * (0.6 + Math.random() * 0.8),
    reverse,
  }
}

export default function NetworkCanvas({
  className = '',
  interactive = false,
  activationStep = 0,
}: NetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mutable ref so the animation loop always reads latest prop values
  const propsRef = useRef({ interactive, activationStep })
  useEffect(() => {
    propsRef.current = { interactive, activationStep }
  }, [interactive, activationStep])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Seed one pulse per edge (staggered)
    const pulses: Pulse[] = EDGES.flatMap((edge, i) => {
      const list: Pulse[] = [{ edgeIndex: i, t: Math.random(), speed: BASE_SPEED * (0.6 + Math.random() * 0.8), reverse: false }]
      if (edge.bidirectional) {
        list.push({ edgeIndex: i, t: Math.random(), speed: BASE_SPEED * (0.6 + Math.random() * 0.8), reverse: true })
      }
      return list
    })

    let animFrame = 0
    let lastTime = performance.now()

    function draw(timestamp: number) {
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp

      const { interactive: isInteractive, activationStep: step } = propsRef.current
      const bright = isInteractive ? 1.3 : 1.0
      const activeNodes = ACTIVE_NODES_BY_STEP[step] ?? []

      // Canvas CSS size (ResizeObserver keeps pixel size in sync)
      const dpr = devicePixelRatio
      const w = canvas!.width / dpr
      const h = canvas!.height / dpr
      const showLabels = w >= 500

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      // ── Node pixel positions ────────────────────────────────────────────────
      const pos: Record<string, { x: number; y: number }> = {}
      for (const node of NODES) {
        pos[node.id] = { x: node.rx * w, y: node.ry * h }
      }

      const nodeRadius = Math.max(6, Math.min(14, w * 0.014))
      const pulseRadius = Math.max(2.5, nodeRadius * 0.28)
      const arrowSize = nodeRadius * 0.55

      // ── Edges ───────────────────────────────────────────────────────────────
      for (let i = 0; i < EDGES.length; i++) {
        const edge = EDGES[i]
        const a = pos[edge.from]
        const b = pos[edge.to]
        const fromNode = nodeById(edge.from)
        const toNode   = nodeById(edge.to)

        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / dist
        const ny = dy / dist

        const sx = a.x + nx * nodeRadius
        const sy = a.y + ny * nodeRadius
        const ex = b.x - nx * (nodeRadius + 4)
        const ey = b.y - ny * (nodeRadius + 4)

        const isEdgeActive = activeNodes.includes(edge.from) && activeNodes.includes(edge.to)
        const edgeAlpha = isEdgeActive ? (isInteractive ? 0.65 : 0.45) : 0.15
        const lineW     = isEdgeActive ? 1.5 : 0.8

        const grad = ctx!.createLinearGradient(sx, sy, ex, ey)
        grad.addColorStop(0, rgbStr(fromNode.glowColor, edgeAlpha, bright))
        grad.addColorStop(1, rgbStr(toNode.glowColor,   edgeAlpha, bright))

        ctx!.beginPath()
        ctx!.moveTo(sx, sy)
        ctx!.lineTo(ex, ey)
        ctx!.strokeStyle = grad
        ctx!.lineWidth = lineW
        ctx!.stroke()

        const angle = Math.atan2(dy, dx)
        drawArrowhead(ctx!, ex, ey, angle, arrowSize, rgbStr(toNode.glowColor, edgeAlpha * 1.5, bright))

        // Reverse direction line + arrowhead for bidirectional
        if (edge.bidirectional) {
          const sx2 = b.x - nx * nodeRadius
          const sy2 = b.y - ny * nodeRadius
          const ex2 = a.x + nx * (nodeRadius + 4)
          const ey2 = a.y + ny * (nodeRadius + 4)

          ctx!.beginPath()
          ctx!.moveTo(sx2 - ny * BIDIR_OFFSET, sy2 + nx * BIDIR_OFFSET)
          ctx!.lineTo(ex2 - ny * BIDIR_OFFSET, ey2 + nx * BIDIR_OFFSET)
          ctx!.strokeStyle = rgbStr(fromNode.glowColor, edgeAlpha * 0.7, bright)
          ctx!.lineWidth = 0.7
          ctx!.stroke()

          drawArrowhead(ctx!, ex2 - ny * BIDIR_OFFSET, ey2 + nx * BIDIR_OFFSET, angle + Math.PI, arrowSize * 0.85, rgbStr(fromNode.glowColor, edgeAlpha * 1.2, bright))
        }
      }

      // ── Spawn extra pulses ──────────────────────────────────────────────────
      const spawnRate = isInteractive ? 0.0008 : 0.00022
      for (let i = 0; i < EDGES.length; i++) {
        if (Math.random() < spawnRate * dt) {
          pulses.push(makePulse(i, false))
          if (EDGES[i].bidirectional && Math.random() < 0.5) {
            pulses.push(makePulse(i, true))
          }
        }
      }

      // ── Advance & draw pulses ───────────────────────────────────────────────
      const speedMult = isInteractive ? 3 : 1
      let pi = pulses.length
      while (pi--) {
        const pulse = pulses[pi]
        pulse.t += pulse.speed * dt * speedMult
        if (pulse.t > 1) { pulses.splice(pi, 1); continue }

        const edge = EDGES[pulse.edgeIndex]
        const a = pos[edge.from]
        const b = pos[edge.to]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / dist
        const ny = dy / dist

        // Offset the reverse pulse slightly so it doesn't overlap the forward one
        const offX = pulse.reverse ? -ny * BIDIR_OFFSET : 0
        const offY = pulse.reverse ?  nx * BIDIR_OFFSET : 0

        const fx = pulse.reverse ? (b.x - nx * nodeRadius + offX) : (a.x + nx * nodeRadius + offX)
        const fy = pulse.reverse ? (b.y - ny * nodeRadius + offY) : (a.y + ny * nodeRadius + offY)
        const tx = pulse.reverse ? (a.x + nx * nodeRadius + offX) : (b.x - nx * nodeRadius + offX)
        const ty = pulse.reverse ? (a.y + ny * nodeRadius + offY) : (b.y - ny * nodeRadius + offY)

        const px = fx + (tx - fx) * pulse.t
        const py = fy + (ty - fy) * pulse.t

        const srcNode   = pulse.reverse ? nodeById(edge.to) : nodeById(edge.from)
        const edgeActive = activeNodes.includes(edge.from) && activeNodes.includes(edge.to)
        const pulseAlpha = edgeActive ? (isInteractive ? 1.0 : 0.85) : 0.35

        // Trail
        const trailLen  = 0.12
        const trailFrac = Math.max(0, pulse.t - trailLen)
        const trailX = fx + (tx - fx) * trailFrac
        const trailY = fy + (ty - fy) * trailFrac
        const trailGrad = ctx!.createLinearGradient(trailX, trailY, px, py)
        trailGrad.addColorStop(0, rgbStr(srcNode.glowColor, 0, bright))
        trailGrad.addColorStop(1, rgbStr(srcNode.glowColor, pulseAlpha * 0.6, bright))
        ctx!.beginPath()
        ctx!.moveTo(trailX, trailY)
        ctx!.lineTo(px, py)
        ctx!.strokeStyle = trailGrad
        ctx!.lineWidth = pulseRadius * 1.4
        ctx!.stroke()

        // Halo glow
        const halo = ctx!.createRadialGradient(px, py, 0, px, py, pulseRadius * 3.5)
        halo.addColorStop(0, rgbStr(srcNode.glowColor, pulseAlpha * 0.7, bright))
        halo.addColorStop(1, rgbStr(srcNode.glowColor, 0, bright))
        ctx!.beginPath()
        ctx!.arc(px, py, pulseRadius * 3.5, 0, Math.PI * 2)
        ctx!.fillStyle = halo
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(px, py, pulseRadius, 0, Math.PI * 2)
        ctx!.fillStyle = rgbStr(srcNode.glowColor, pulseAlpha, bright)
        ctx!.fill()
      }

      // ── Nodes ───────────────────────────────────────────────────────────────
      const nowSec = timestamp * 0.001
      for (const node of NODES) {
        const { x, y } = pos[node.id]
        const isActive = activeNodes.includes(node.id)
        const isResult = node.id === 'result' && step === 5
        const nodeAlpha  = isActive ? 1.0 : 0.25
        const nodeBright = isActive ? bright : 1.0

        // Pulsing glow ring (active nodes only)
        if (isActive) {
          const ringPulse  = 0.5 + 0.5 * Math.sin(nowSec * 2.5 + node.rx * 10)
          const ringRadius = nodeRadius * (1.8 + ringPulse * (isResult ? 1.4 : 0.7))
          const ringAlpha  = (isResult ? 0.55 : 0.32) * (isInteractive ? 1.4 : 1)
          const ring = ctx!.createRadialGradient(x, y, nodeRadius * 0.85, x, y, ringRadius)
          ring.addColorStop(0, rgbStr(node.glowColor, ringAlpha, nodeBright))
          ring.addColorStop(1, rgbStr(node.glowColor, 0, nodeBright))
          ctx!.beginPath()
          ctx!.arc(x, y, ringRadius, 0, Math.PI * 2)
          ctx!.fillStyle = ring
          ctx!.fill()
        }

        // Soft body glow behind node
        const bodyGlow = ctx!.createRadialGradient(x, y, 0, x, y, nodeRadius * 2.2)
        bodyGlow.addColorStop(0, rgbStr(node.glowColor, nodeAlpha * 0.45, nodeBright))
        bodyGlow.addColorStop(1, rgbStr(node.glowColor, 0, nodeBright))
        ctx!.beginPath()
        ctx!.arc(x, y, nodeRadius * 2.2, 0, Math.PI * 2)
        ctx!.fillStyle = bodyGlow
        ctx!.fill()

        // Node fill
        ctx!.beginPath()
        ctx!.arc(x, y, nodeRadius, 0, Math.PI * 2)
        ctx!.fillStyle = rgbStr(node.color, nodeAlpha * 0.85, nodeBright)
        ctx!.fill()

        // Node border
        ctx!.beginPath()
        ctx!.arc(x, y, nodeRadius, 0, Math.PI * 2)
        ctx!.strokeStyle = rgbStr(node.glowColor, nodeAlpha, nodeBright)
        ctx!.lineWidth = isActive ? 1.8 : 0.8
        ctx!.stroke()

        // Label
        if (showLabels) {
          const fontSize = Math.max(9, Math.min(11, w * 0.011))
          ctx!.font = `${fontSize}px ui-monospace,monospace`
          ctx!.textAlign = 'center'
          ctx!.textBaseline = 'top'
          ctx!.fillStyle = rgbStr(node.glowColor, isActive ? 0.9 : 0.3, nodeBright)
          ctx!.fillText(node.label, x, y + nodeRadius + 4)
        }
      }

      animFrame = requestAnimationFrame(draw)
    }

    animFrame = requestAnimationFrame(draw)

    // ── Resize handling ──────────────────────────────────────────────────────
    function syncSize() {
      if (!canvas || !ctx) return
      const rect = canvas.getBoundingClientRect()
      const dpr = devicePixelRatio
      canvas.width  = Math.round(rect.width  * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animFrame)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
