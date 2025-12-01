import { cn } from '../../lib/utils'

export function Input({ className = '', error, ...props }) {
  return (
    <input
      className={cn(
        'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition',
        error ? 'border-red-500' : 'border-gray-200',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className = '', error, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none',
        error ? 'border-red-500' : 'border-gray-200',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className = '', error, children, ...props }) {
  return (
    <select
      className={cn(
        'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition bg-white',
        error ? 'border-red-500' : 'border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
