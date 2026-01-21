/**
 * HelpTip Component
 * Shows a small info icon that displays helpful information on hover
 */

import { HelpCircle, Info, Lightbulb } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * HelpTip - Inline help icon with tooltip
 * @param {string} children - The help text to display
 * @param {string} variant - 'info' | 'help' | 'tip' - Icon style
 * @param {string} side - 'top' | 'bottom' | 'left' | 'right' - Tooltip position
 * @param {string} className - Additional classes
 */
export function HelpTip({ 
  children, 
  variant = 'info', 
  side = 'top',
  className = '' 
}) {
  const icons = {
    info: Info,
    help: HelpCircle,
    tip: Lightbulb
  }
  const Icon = icons[variant] || Info

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex cursor-help ${className}`}>
            <Icon className="w-4 h-4 text-[#0F0F0F]/40 hover:text-[#2969FF] transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * FeatureCard - Card with title, description, and optional help
 */
export function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  tip, 
  children,
  className = '' 
}) {
  return (
    <div className={`bg-white rounded-xl border border-[#0F0F0F]/10 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-10 h-10 bg-[#2969FF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-[#2969FF]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#0F0F0F]">{title}</h3>
            {tip && <HelpTip>{tip}</HelpTip>}
          </div>
          {description && (
            <p className="text-sm text-[#0F0F0F]/60 mt-1">{description}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * SectionHeader - Section title with optional help
 */
export function SectionHeader({ 
  title, 
  description, 
  tip,
  action,
  className = '' 
}) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0F0F0F]">{title}</h2>
          {tip && <HelpTip>{tip}</HelpTip>}
        </div>
        {description && (
          <p className="text-sm text-[#0F0F0F]/60 mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/**
 * OnboardingBanner - Helpful banner for new features
 */
export function OnboardingBanner({ 
  icon: Icon = Lightbulb,
  title, 
  description, 
  action,
  onDismiss,
  variant = 'info' // 'info' | 'success' | 'warning'
}) {
  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900'
  }

  return (
    <div className={`rounded-xl border p-4 ${variants[variant]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          {description && (
            <p className="text-sm opacity-80 mt-1">{description}</p>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-current opacity-50 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

export default HelpTip
