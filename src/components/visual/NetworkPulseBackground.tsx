'use client'

import { motion } from 'framer-motion'

export default function NetworkPulseBackground({ className = '' }: { className?: string }) {
  const strands = [
    'M20 220C140 80 280 80 400 220',
    'M40 260C180 120 300 120 460 260',
    'M10 310C120 180 340 180 500 310',
    'M40 350C220 220 340 220 540 350',
    'M120 380C260 260 440 260 620 380',
  ]

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.18),rgba(3,7,18,0.02)_46%,rgba(3,7,18,0.94)_90%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 700 420" fill="none" preserveAspectRatio="none">
        {strands.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            stroke="url(#strand)"
            strokeWidth={i % 2 === 0 ? 1.2 : 1.8}
            strokeLinecap="round"
            initial={{ pathLength: 0.2, opacity: 0.25 }}
            animate={{ pathLength: [0.2, 1, 0.2], opacity: [0.18, 0.7, 0.18] }}
            transition={{ duration: 6 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          />
        ))}
        <defs>
          <linearGradient id="strand" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.25" />
          </linearGradient>
        </defs>
      </svg>

      {[...Array(20)].map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300/80"
          style={{ left: `${8 + i * 4.6}%`, top: `${18 + (i % 7) * 9}%` }}
          animate={{ y: [0, -18, 0], opacity: [0.2, 0.95, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 3.2 + (i % 6) * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}
