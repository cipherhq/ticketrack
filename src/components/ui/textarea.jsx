import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl border border-[#0F0F0F]/10 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-[#0F0F0F]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2969FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
