export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${className}`}
      {...props}
    />
  )
}
