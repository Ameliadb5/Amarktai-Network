'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
}

interface Edge {
  a: number
  b: number
  opacity: number
}

const COLORS = [
  'rgba(59,130,246,0.9)',   // blue
  'rgba(34,211,238,0.9)',   // cyan
  'rgba(139,92,246,0.9)',   // violet
  'rgba(168,85,247,0.7)',   // magenta
  'rgba(6,182,212,0.8)',    // teal
]

export default function NetworkCanvas({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      initNodes()
    }

    const initNodes = () => {
      const count = Math.min(40, Math.floor(canvas.width / 30))
      nodesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.5 + 1,
        opacity: Math.random() * 0.5 + 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
      edgesRef.current = []
    }

    const draw = () => {
      const nodes = nodesRef.current
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Update positions
      nodes.forEach(node => {
        node.x += node.vx
        node.y += node.vy
        if (node.x < 0 || node.x > w) node.vx *= -1
        if (node.y < 0 || node.y > h) node.vy *= -1
        node.x = Math.max(0, Math.min(w, node.x))
        node.y = Math.max(0, Math.min(h, node.y))
      })

      // Draw edges
      const maxDist = Math.min(w, h) * 0.22
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.35
            ctx.beginPath()
            const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)
            grad.addColorStop(0, nodes[i].color.replace('0.9', String(alpha)).replace('0.8', String(alpha)).replace('0.7', String(alpha)))
            grad.addColorStop(1, nodes[j].color.replace('0.9', String(alpha)).replace('0.8', String(alpha)).replace('0.7', String(alpha)))
            ctx.strokeStyle = grad
            ctx.lineWidth = 0.8
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      nodes.forEach(node => {
        // Outer glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4)
        gradient.addColorStop(0, node.color.replace('0.9', '0.4').replace('0.8', '0.35').replace('0.7', '0.3'))
        gradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.fill()
      })

      animRef.current = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ opacity: 0.6 }}
    />
  )
}
