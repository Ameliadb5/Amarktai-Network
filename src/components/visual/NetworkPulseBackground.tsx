'use client'

import { motion } from 'framer-motion'

/** A connection line with a single traveling dot along it */
function TravelingLine({
  d,
  strokeWidth = 1,
  delay = 0,
  duration = 4,
  color = '#22d3ee',
}: {
  d: string
  strokeWidth?: number
  delay?: number
  duration?: number
  color?: string
}) {
  return (
    <g>
      {/* Static dim track */}
      <path d={d} stroke={color} strokeWidth={strokeWidth * 0.5} strokeOpacity={0.08} fill="none" strokeLinecap="round" />
      {/* Traveling bright segment */}
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
        animate={{
          pathLength: [0.0, 0.12, 0.08, 0.0],
          pathOffset: [0, 0.12, 0.6, 1.0],
          opacity: [0, 0.9, 0.9, 0],
        }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay, repeatDelay: duration * 0.2 }}
      />
    </g>
  )
}

export default function NetworkPulseBackground({ className = '' }: { className?: string }) {
  const strands = [
    'M20 220C140 80 280 80 400 220',
    'M40 260C180 120 300 120 460 260',
    'M10 310C120 180 340 180 500 310',
    'M40 350C220 220 340 220 540 350',
    'M120 380C260 260 440 260 620 380',
  ]

  // Longer diagonal connection lines — source → destination feel
  const connections = [
    { d: 'M-40 420 C120 300 280 200 700 80', color: '#22d3ee', duration: 5.5, delay: 0 },
    { d: 'M700 420 C560 310 400 200 -40 100', color: '#60a5fa', duration: 6.2, delay: 1.2 },
    { d: 'M0 280 C160 180 360 160 720 280', color: '#a78bfa', duration: 4.8, delay: 0.6 },
    { d: 'M350 -20 C340 100 360 300 350 440', color: '#22d3ee', duration: 5.0, delay: 2.1 },
    { d: 'M-40 150 C200 130 450 260 720 180', color: '#818cf8', duration: 6.8, delay: 1.8 },
    { d: 'M100 440 C180 300 520 120 680 0', color: '#34d399', duration: 7.2, delay: 3.0 },
  ]

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden={true}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.18),rgba(3,7,18,0.02)_46%,rgba(3,7,18,0.94)_90%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 700 420" fill="none" preserveAspectRatio="none">
        {/* Ambient animated strand paths */}
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

        {/* Traveling-dot connection lines */}
        {connections.map((c, i) => (
          <TravelingLine key={i} d={c.d} strokeWidth={1.4} color={c.color} duration={c.duration} delay={c.delay} />
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
