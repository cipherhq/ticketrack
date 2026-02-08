import { Toaster as Sonner } from 'sonner'

export function Toaster({ ...props }) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/10 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-[#2969FF] group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-foreground',
          success: 'group-[.toaster]:bg-green-50 group-[.toaster]:border-green-200',
          error: 'group-[.toaster]:bg-red-50 group-[.toaster]:border-red-200',
          warning: 'group-[.toaster]:bg-yellow-50 group-[.toaster]:border-yellow-200',
          info: 'group-[.toaster]:bg-blue-50 group-[.toaster]:border-blue-200',
        },
      }}
      {...props}
    />
  )
}
