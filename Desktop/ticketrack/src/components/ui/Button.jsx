export function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  const baseStyles = 'font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-white hover:bg-gray-100 text-primary-500 border-2 border-primary-500',
    outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
