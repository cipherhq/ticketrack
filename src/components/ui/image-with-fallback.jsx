import { useState } from 'react'
import { cn } from '@/lib/utils'

export function ImageWithFallback({ src, alt, className, fallbackClassName, ...props }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  if (error || !src) {
    return (
      <div 
        className={cn(
          'bg-gradient-to-br from-[#2969FF] to-[#2969FF]/60 flex items-center justify-center',
          fallbackClassName || className
        )}
        {...props}
      >
        <span className="text-white/60 text-4xl">🎫</span>
      </div>
    )
  }

  return (
    <>
      {loading && (
        <div className={cn('bg-gray-100 animate-pulse', className)} {...props} />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, loading && 'hidden')}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
        {...props}
      />
    </>
  )
}
