'use client'

import { motion } from 'framer-motion'

/** Node definitions — represents apps/services in the network */
const NODES = [
  { id: 'genx',    x: 370,  y: 200, r: 6,   color: '#22d3ee', label: 'GenX'      },
  { id: 'github',  x: 130,  y: 130, r: 3.5, color: '#60a5fa', label: 'GitHub'    },
  { id: 'app1',    x: 610,  y: 130, r: 3.5, color: '#a78bfa', label: 'App Agent' },
  { id: 'deploy',  x: 640,  y: 280, r: 3.5, color: '#34d399', label: 'Deploy'    },
  { id: 'model1',  x: 200,  y: 290, r: 3.5, color: '#60a5fa', label: 'Model'     },
  { id: 'ws',      x: 110,  y: 250, r: 3,   color: '#67e8f9', label: 'Workspace' },
  { id: 'artifact',x: 490,  y: 320, r: 3,   color: '#f472b6', label: 'Artifact'  },
  { id: 'model2',  x: 290,  y: 90,  r: 3,   color: '#818cf8', label: 'Model'     },
]

/** Paths — intentional arcs between nodes, not random lines */
const CONNECTIONS: Array<{
  d: string
  color: string
  delay: number
  duration: number
}> = [
  // Workspace → GenX
  { d: 'M115 248 C200 220 300 210 366 200', color: '#22d3ee', delay: 0,   duration: 3.2 },
  // GitHub → GenX
  { d: 'M133 133 C220 150 300 170 366 198', color: '#60a5fa', delay: 0.8, duration: 3.6 },
  // GenX → App Agent
  { d: 'M374 198 C460 165 540 145 607 133', color: '#a78bfa', delay: 1.6, duration: 3.0 },
  // GenX → Deploy
  { d: 'M373 204 C480 230 560 258 637 278', color: '#34d399', delay: 2.4, duration: 3.4 },
  // GenX → Artifact
  { d: 'M371 206 C420 260 455 295 487 318', color: '#f472b6', delay: 1.0, duration: 2.8 },
  // Model1 → GenX
  { d: 'M203 289 C270 260 320 235 366 202', color: '#60a5fa', delay: 0.4, duration: 3.8 },
  // Model2 → GenX (top arc)
  { d: 'M292 93  C320 130 345 160 368 196', color: '#818cf8', delay: 1.2, duration: 3.2 },
]

/** A small glowing dot that travels along a path */
function AgentDot({
  d, color, delay, duration,
}: {
  d: string; color: string; delay: number; duration: number
}) {
  return (
    <>
      {/* Static dim connector line */}
      <path d={d} stroke={color} strokeOpacity={0.10} strokeWidth={1} fill="none" strokeLinecap="round" />
      {/* Traveling pulse (pathLength animation — dot illusion via dasharray) */}
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="6 600"
        strokeDashoffset={0}
        initial={{ opacity: 0 }}
        animate={{
          strokeDashoffset: [-10, -620],
          opacity: [0, 0.9, 0.9, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          delay,
          ease: 'easeInOut',
          times: [0, 0.1, 0.85, 1],
        }}
      />
    </>
  )
}

export default function NetworkPulseBackground({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden={true}
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(56,189,248,0.14)_0%,rgba(99,102,241,0.06)_40%,rgba(3,7,18,0.0)_70%)]" />
      {/* Soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent_50%,rgba(3,7,18,0.85)_90%)]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 740 400"
        fill="none"
        preserveAspectRatio="none"
      >
        {/* Connection paths with agent dots */}
        {CONNECTIONS.map((c, i) => (
          <AgentDot key={i} d={c.d} color={c.color} delay={c.delay} duration={c.duration} />
        ))}

        {/* Node rings — outer pulse */}
        {NODES.map((n, i) => (
          <motion.circle
            key={`ring-${n.id}`}
            cx={n.x}
            cy={n.y}
            r={n.r + 4}
            stroke={n.color}
            strokeOpacity={0}
            strokeWidth={1}
            fill="none"
            animate={{ r: [n.r + 2, n.r + 10], strokeOpacity: [0.4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
          />
        ))}

        {/* Node dots */}
        {NODES.map((n) => (
          <motion.circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.color}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: Math.random() * 1.5, ease: 'easeInOut' }}
          />
        ))}

        {/* GenX core — larger central glow */}
        <motion.circle
          cx={NODES[0].x}
          cy={NODES[0].y}
          r={14}
          fill="#22d3ee"
          fillOpacity={0}
          stroke="#22d3ee"
          strokeOpacity={0.15}
          strokeWidth={1}
          animate={{ r: [12, 22], strokeOpacity: [0.25, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}
