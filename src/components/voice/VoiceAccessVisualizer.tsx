'use client'

import { motion } from 'framer-motion'

export type VoiceVisualMode = 'idle' | 'listening' | 'speaking'

export default function VoiceAccessVisualizer({ mode }: { mode: VoiceVisualMode }) {
  const isListening = mode === 'listening'
  const isSpeaking = mode === 'speaking'
  const bars = [12, 24, 18, 32, 16, 28, 14, 26]

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#050b1a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.2),rgba(5,11,26,0.95)_65%)]" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 720 260" fill="none" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => (
          <motion.path
            key={line}
            d={`M-20 ${70 + line * 45} C 140 ${20 + line * 40}, 380 ${130 + line * 10}, 760 ${50 + line * 55}`}
            stroke={isSpeaking ? 'rgba(34,211,238,0.95)' : isListening ? 'rgba(96,165,250,0.9)' : 'rgba(148,163,184,0.45)'}
            strokeWidth={isSpeaking ? 2.2 : 1.6}
            initial={{ pathLength: 0.3, opacity: 0.35 }}
            animate={{ pathLength: [0.2, 1, 0.2], opacity: isSpeaking ? [0.35, 1, 0.35] : isListening ? [0.25, 0.82, 0.25] : [0.2, 0.45, 0.2] }}
            transition={{ duration: isSpeaking ? 2.4 : isListening ? 3.2 : 5.5, repeat: Infinity, ease: 'easeInOut', delay: line * 0.35 }}
          />
        ))}
      </svg>

      <div className="absolute inset-x-8 bottom-8 flex items-end justify-center gap-2">
        {bars.map((h, i) => (
          <motion.span
            key={i}
            className="w-2 rounded-full bg-gradient-to-t from-blue-500 to-cyan-300"
            animate={{
              height: isSpeaking ? [h * 0.8, h * 2.1, h * 0.9] : isListening ? [h * 0.55, h * 1.35, h * 0.6] : [h * 0.35, h * 0.5, h * 0.35],
              opacity: isSpeaking ? [0.45, 1, 0.45] : isListening ? [0.35, 0.82, 0.35] : [0.2, 0.35, 0.2],
            }}
            transition={{ duration: isSpeaking ? 0.8 : isListening ? 1.3 : 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
            style={{ height: h }}
          />
        ))}
      </div>

      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        animate={{
          scale: isSpeaking ? [0.95, 1.28, 0.95] : isListening ? [0.95, 1.12, 0.95] : [0.96, 1.02, 0.96],
          opacity: isSpeaking ? [0.35, 0.85, 0.35] : isListening ? [0.25, 0.65, 0.25] : [0.2, 0.35, 0.2],
        }}
        transition={{ duration: isSpeaking ? 1.2 : isListening ? 2 : 4.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ borderColor: isSpeaking ? 'rgba(34,211,238,0.8)' : isListening ? 'rgba(96,165,250,0.7)' : 'rgba(148,163,184,0.5)' }}
      />
    </div>
  )
}
