'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Brain, DollarSign, Route, FlaskConical, Bot } from 'lucide-react'

/**
 * The generic API Keys section has been superseded.
 *
 * AI provider keys are managed in AI Providers.
 * Budget limits are configured in Budgets.
 * Model routing is configured in Routing Policies.
 * Playground / dev tooling is in the Developer section.
 */
export default function ApiKeysRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect to AI Providers after 3s
    const t = setTimeout(() => router.push('/admin/dashboard/ai-providers'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Keys (Removed)</h1>
        <p className="text-slate-400 text-sm mt-1">
          The generic API Keys section has been replaced by a proper provider and budget system.
          Redirecting to AI Providers in 3 seconds…
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/15 space-y-4">
        <p className="text-amber-400 text-sm font-medium">This page is deprecated.</p>
        <p className="text-slate-400 text-sm">
          All AI provider keys and credentials are now managed through dedicated sections:
        </p>
        <ul className="space-y-3">
          {[
            { href: '/admin/dashboard/ai-providers', label: 'AI Providers',     Icon: Brain,       desc: 'Configure API keys, health checks, and provider settings'    },
            { href: '/admin/dashboard/budgets',      label: 'Budgets',           Icon: DollarSign,  desc: 'Set monthly spend limits and threshold alerts per provider' },
            { href: '/admin/dashboard/routing',      label: 'Routing Policies',  Icon: Route,       desc: 'Configure routing rules, fallbacks, and escalation policies' },
            { href: '/admin/dashboard/playground',   label: 'Playground',        Icon: FlaskConical, desc: 'Test and compare models in the admin playground'           },
            { href: '/admin/dashboard/agent-workspace', label: 'Agent Workspace', Icon: Bot,        desc: 'Inspect and prototype agents and workflows'                },
          ].map(({ href, label, Icon, desc }) => (
            <li key={href}>
              <a
                href={href}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all group"
              >
                <Icon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0 group-hover:text-blue-300 transition-colors" />
                <div>
                  <p className="font-medium text-white text-sm">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
