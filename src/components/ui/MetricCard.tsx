import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: number
  icon?: ReactNode
  className?: string
  suffix?: string
}

export default function MetricCard({ label, value, change, icon, className, suffix }: MetricCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className={cn('glass rounded-xl p-4 space-y-2 relative overflow-hidden group border border-white/5 hover:border-blue-500/20 transition-all duration-300', className)}>
      {/* Gradient top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">{label}</span>
        {icon && <div className="text-blue-400/70 group-hover:text-blue-400 transition-colors">{icon}</div>}
      </div>
      <div className="flex items-end justify-between relative z-10">
        <div>
          <span className="font-heading text-2xl font-bold text-white">
            {value}
          </span>
          {suffix && <span className="text-sm text-slate-400 ml-1">{suffix}</span>}
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-400'
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
    </div>
  )
}
