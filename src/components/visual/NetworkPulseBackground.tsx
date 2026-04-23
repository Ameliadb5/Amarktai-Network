'use client'

import { motion } from 'framer-motion'

const arcs = [
  'M40 280C180 130 320 120 660 260',
  'M20 330C220 190 380 180 700 320',
  'M100 360C280 250 460 250 640 360',
]

const CORE_NODE = { x: 360, y: 215 }
const EDGE_NODES = [
  { x: 160, y: 176 },
  { x: 252, y: 136 },
  { x: 460, y: 148 },
  { x: 560, y: 198 },
  { x: 238, y: 286 },
  { x: 470, y: 286 },
]

function PulsePath({ d, delay = 0, color = '#22d3ee' }: { d: string; delay?: number; color?: string }) {
  return (
    <>
      <path d={d} stroke={color} strokeOpacity={0.08} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 0.18, 0], opacity: [0, 0.85, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay }}
      />
    </>
  )
}

export default function NetworkPulseBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden={true}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,0.18),rgba(3,7,18,0.05)_46%,rgba(3,7,18,0.95)_90%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 740 420" fill="none" preserveAspectRatio="none">
        {arcs.map((d, i) => (
          <PulsePath key={d} d={d} delay={i * 0.75} color={i === 1 ? '#60a5fa' : '#22d3ee'} />
        ))}

        <motion.circle
          cx={CORE_NODE.x}
          cy={CORE_NODE.y}
          r="7"
          fill="#67e8f9"
          animate={{ opacity: [0.4, 0.95, 0.4], scale: [1, 1.22, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {EDGE_NODES.map((n, i) => (
          <motion.circle
            key={`${n.x}-${n.y}`}
            cx={n.x}
            cy={n.y}
            r="3.5"
            fill="#93c5fd"
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </svg>
    </div>
  )
}
