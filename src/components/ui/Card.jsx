import { cn } from '../../lib/utils'

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children }) {
  return (
    <div className={cn('p-6 border-b border-gray-100', className)}>
      {children}
    </div>
  )
}

export function CardContent({ className = '', children }) {
  return (
    <div className={cn('p-6', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className = '', children }) {
  return (
    <div className={cn('p-6 border-t border-gray-100', className)}>
      {children}
    </div>
  )
}
