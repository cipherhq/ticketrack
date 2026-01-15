/**
 * WalletButtons Component
 * Add to Apple Wallet / Google Wallet / Calendar buttons
 */

import { useState } from 'react'
import { Wallet, Calendar, Smartphone, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  addToWallet, 
  generateCalendarFile, 
  isIOS, 
  isAndroid,
  getAppleWalletPass,
  getGoogleWalletPass
} from '@/utils/walletPass'

// Apple Wallet SVG Icon
const AppleWalletIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

// Google Wallet SVG Icon
const GoogleWalletIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.13 17.35c-.19.53-.73.88-1.3.88H8.17c-.57 0-1.11-.35-1.3-.88L4.5 10.48c-.23-.62.22-1.28.88-1.28h13.24c.66 0 1.11.66.88 1.28l-2.37 6.87zM17.5 8H6.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h11c.28 0 .5.22.5.5s-.22.5-.5.5z"/>
  </svg>
)

export function WalletButtons({ ticket, event, size = 'default', className = '' }) {
  const [loading, setLoading] = useState(null) // 'apple' | 'google' | 'calendar'
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  const handleAddToWallet = async (platform) => {
    setLoading(platform)
    setError(null)
    setSuccess(null)

    try {
      let result
      
      if (platform === 'apple') {
        result = await getAppleWalletPass(ticket.id)
      } else if (platform === 'google') {
        result = await getGoogleWalletPass(ticket.id)
      } else {
        result = generateCalendarFile(ticket, event)
      }

      if (platform === 'calendar') {
        setSuccess('calendar')
      } else if (result.fallback) {
        // Wallet not configured - show a helpful message but don't auto-fallback to calendar
        setError(result.message || `${platform === 'apple' ? 'Apple' : 'Google'} Wallet coming soon! Use "Add to Calendar" for now.`)
      } else if (result.success) {
        setSuccess(platform)
      } else {
        setError(result.error || 'Failed to add to wallet')
      }
    } catch (err) {
      console.error('Wallet error:', err)
      setError(err.message || 'Something went wrong. Try "Add to Calendar" instead.')
    } finally {
      setLoading(null)
      // Clear success/error message after 5 seconds
      setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
    }
  }

  const isSmall = size === 'sm'
  const buttonClass = isSmall ? 'h-8 text-xs px-2' : 'h-10 text-sm px-4'

  // Show device-specific primary button
  const showApple = isIOS()
  const showGoogle = isAndroid()
  const showBoth = !showApple && !showGoogle // Desktop shows both

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Apple Wallet Button - Show on iOS or desktop */}
      {(showApple || showBoth) && (
        <Button
          variant="outline"
          size={size}
          onClick={() => handleAddToWallet('apple')}
          disabled={loading !== null}
          className={`${buttonClass} bg-black text-white border-black hover:bg-gray-800 hover:text-white`}
        >
          {loading === 'apple' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : success === 'apple' ? (
            <Check className="w-4 h-4 mr-2 text-green-400" />
          ) : (
            <AppleWalletIcon className="w-4 h-4 mr-2" />
          )}
          {isSmall ? 'Apple' : 'Add to Apple Wallet'}
        </Button>
      )}

      {/* Google Wallet Button - Show on Android or desktop */}
      {(showGoogle || showBoth) && (
        <Button
          variant="outline"
          size={size}
          onClick={() => handleAddToWallet('google')}
          disabled={loading !== null}
          className={`${buttonClass} bg-white text-gray-800 border-gray-300 hover:bg-gray-50`}
        >
          {loading === 'google' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : success === 'google' ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <GoogleWalletIcon className="w-4 h-4 mr-2" />
          )}
          {isSmall ? 'Google' : 'Add to Google Wallet'}
        </Button>
      )}

      {/* Calendar Button - Always available */}
      <Button
        variant="outline"
        size={size}
        onClick={() => handleAddToWallet('calendar')}
        disabled={loading !== null}
        className={buttonClass}
      >
        {loading === 'calendar' ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : success === 'calendar' ? (
          <Check className="w-4 h-4 mr-2 text-green-500" />
        ) : (
          <Calendar className="w-4 h-4 mr-2" />
        )}
        {isSmall ? 'Calendar' : 'Add to Calendar'}
      </Button>

      {/* Error/Info message */}
      {error && (
        <div className={`w-full flex items-center gap-2 text-sm mt-1 ${
          error.includes('coming soon') ? 'text-amber-600' : 'text-red-600'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* Success message */}
      {success === 'calendar' && (
        <div className="w-full flex items-center gap-2 text-sm text-green-600 mt-1">
          <Check className="w-4 h-4" />
          Event added to your calendar!
        </div>
      )}
      {success === 'apple' && (
        <div className="w-full flex items-center gap-2 text-sm text-green-600 mt-1">
          <Check className="w-4 h-4" />
          Added to Apple Wallet!
        </div>
      )}
      {success === 'google' && (
        <div className="w-full flex items-center gap-2 text-sm text-green-600 mt-1">
          <Check className="w-4 h-4" />
          Added to Google Wallet!
        </div>
      )}
    </div>
  )
}

/**
 * Compact wallet button for inline use
 */
export function WalletButtonCompact({ ticket, event }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await addToWallet(ticket, event, 'auto')
    } catch (err) {
      console.error('Wallet error:', err)
      // Fallback to calendar
      generateCalendarFile(ticket, event)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="h-8 px-2"
      title={isIOS() ? 'Add to Apple Wallet' : isAndroid() ? 'Add to Google Wallet' : 'Add to Calendar'}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isIOS() ? (
        <AppleWalletIcon className="w-4 h-4" />
      ) : isAndroid() ? (
        <GoogleWalletIcon className="w-4 h-4" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
    </Button>
  )
}
