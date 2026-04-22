'use client'

import { motion, AnimatePresence } from 'framer-motion'

/** Set the alpha value of an rgba() color string to a specific value */
function withAlpha(rgba: string, alpha: number): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgba
  return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`
}

export type VoiceVisualMode = 'idle' | 'listening' | 'processing' | 'speaking' | 'success' | 'fallback'

const STATE_LABEL: Record<VoiceVisualMode, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  processing: 'Processing…',
  speaking: 'Responding…',
  success: 'Authenticated',
  fallback: 'Use manual input',
}

const STATE_COLOR: Record<VoiceVisualMode, string> = {
  idle: 'rgba(148,163,184,0.45)',
  listening: 'rgba(96,165,250,0.9)',
  processing: 'rgba(167,139,250,0.9)',
  speaking: 'rgba(34,211,238,0.95)',
  success: 'rgba(52,211,153,0.95)',
  fallback: 'rgba(251,191,36,0.85)',
}

const BAR_COLOR: Record<VoiceVisualMode, [string, string]> = {
  idle: ['#475569', '#64748b'],
  listening: ['#3b82f6', '#60a5fa'],
  processing: ['#7c3aed', '#a78bfa'],
  speaking: ['#0891b2', '#22d3ee'],
  success: ['#059669', '#34d399'],
  fallback: ['#d97706', '#fbbf24'],
}

export default function VoiceAccessVisualizer({
  mode,
  size = 'default',
}: {
  mode: VoiceVisualMode
  /** 'default' for inline panels, 'full' for full-page immersive use */
  size?: 'default' | 'full'
}) {
  const isListening = mode === 'listening'
  const isSpeaking = mode === 'speaking'
  const isProcessing = mode === 'processing'
  const isSuccess = mode === 'success'
  const isActive = isListening || isSpeaking || isProcessing || isSuccess
  const bars = [12, 24, 18, 32, 16, 28, 14, 26, 20, 30, 15, 22]
  const strandColor = STATE_COLOR[mode]
  const [barFrom, barTo] = BAR_COLOR[mode]

  const ringPulse = isSuccess ? [0.9, 1.5, 0.9] : isSpeaking ? [0.95, 1.28, 0.95] : isListening ? [0.95, 1.12, 0.95] : isProcessing ? [0.93, 1.08, 0.93] : [0.96, 1.02, 0.96]
  const ringDuration = isSuccess ? 0.9 : isSpeaking ? 1.2 : isListening ? 2 : isProcessing ? 1.4 : 4.8
  const ringOpacity = isSuccess ? [0.45, 0.95, 0.45] : isSpeaking ? [0.35, 0.85, 0.35] : isListening ? [0.25, 0.65, 0.25] : isProcessing ? [0.2, 0.55, 0.2] : [0.15, 0.3, 0.15]

  const barH = (h: number) =>
    isSuccess ? [h, h * 2.4, h] :
    isSpeaking ? [h * 0.8, h * 2.1, h * 0.9] :
    isListening ? [h * 0.55, h * 1.35, h * 0.6] :
    isProcessing ? [h * 0.4, h * 1.1, h * 0.45] :
    [h * 0.3, h * 0.45, h * 0.3]

  const barDuration = isSuccess ? 0.5 : isSpeaking ? 0.8 : isListening ? 1.3 : isProcessing ? 1.0 : 2.4

  const containerClass = size === 'full'
    ? 'relative w-full h-full overflow-hidden'
    : 'relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#050b1a]'

  return (
    <div className={containerClass}>
      {/* Background radial glow — color shifts with mode */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: isSuccess
            ? 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.22), rgba(5,11,26,0.95) 65%)'
            : isSpeaking
            ? 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.22), rgba(5,11,26,0.95) 65%)'
            : isListening
            ? 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.18), rgba(5,11,26,0.95) 65%)'
            : isProcessing
            ? 'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.18), rgba(5,11,26,0.95) 65%)'
            : 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.1), rgba(5,11,26,0.95) 65%)',
        }}
        transition={{ duration: 0.6 }}
      />

      {/* Animated strands */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 720 260" fill="none" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => (
          <motion.path
            key={line}
            d={`M-20 ${70 + line * 45} C 140 ${20 + line * 40}, 380 ${130 + line * 10}, 760 ${50 + line * 55}`}
            stroke={strandColor}
            strokeWidth={isSpeaking || isSuccess ? 2.4 : 1.6}
            initial={{ pathLength: 0.3, opacity: 0.35 }}
            animate={{
              pathLength: [0.2, 1, 0.2],
              opacity: isActive ? [0.3, isSuccess ? 1 : 0.85, 0.3] : [0.12, 0.35, 0.12],
            }}
            transition={{ duration: isSuccess ? 1.8 : isSpeaking ? 2.4 : isListening ? 3.2 : isProcessing ? 2.0 : 5.5, repeat: Infinity, ease: 'easeInOut', delay: line * 0.35 }}
          />
        ))}
        {/* Processing spinning arc */}
        {isProcessing && (
          <motion.circle
            cx="360" cy="130" r="55"
            stroke="rgba(167,139,250,0.6)"
            strokeWidth="1.5"
            strokeDasharray="60 290"
            fill="none"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '360px 130px' }}
          />
        )}
      </svg>

      {/* Waveform bars */}
      <div className="absolute inset-x-8 bottom-8 flex items-end justify-center gap-1.5">
        {bars.map((h, i) => (
          <motion.span
            key={i}
            className="rounded-full"
            style={{
              background: `linear-gradient(to top, ${barFrom}, ${barTo})`,
              width: '6px',
            }}
            animate={{
              height: barH(h),
              opacity: isActive ? [0.4, 1, 0.4] : [0.15, 0.25, 0.15],
            }}
            transition={{ duration: barDuration, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
            initial={{ height: h * 0.3 }}
          />
        ))}
      </div>

      {/* Central breathing ring */}
      <motion.div
        className="absolute left-1/2 top-[44%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        animate={{ scale: ringPulse, opacity: ringOpacity }}
        transition={{ duration: ringDuration, repeat: Infinity, ease: 'easeInOut' }}
        style={{ borderColor: strandColor }}
      />

      {/* Outer ring — only when active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute left-1/2 top-[44%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1.05, 1.25, 1.05], opacity: [0.08, 0.25, 0.08] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: ringDuration * 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ borderColor: strandColor }}
          />
        )}
      </AnimatePresence>

      {/* State label pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full border text-[11px] font-medium tracking-wide"
          initial={{ opacity: 0, y: -6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.92 }}
          transition={{ duration: 0.25 }}
          style={{
            borderColor: withAlpha(strandColor, 0.3),
            color: withAlpha(strandColor, 1),
            backgroundColor: withAlpha(strandColor, 0.08),
          }}
        >
          {STATE_LABEL[mode]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
