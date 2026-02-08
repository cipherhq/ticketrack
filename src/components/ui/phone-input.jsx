import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { getCountryFromIP } from '@/utils/location'

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
]

// Export countries for use elsewhere
export { COUNTRIES }

export function PhoneInput({ 
  value, 
  onChange, 
  onCountryChange,
  defaultCountry = null, // Now defaults to null for auto-detection
  lockedCountry = null,  // If set, country cannot be changed
  autoDetect = true,     // Auto-detect user's country from IP
  className = '', 
  required = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find(c => c.code === (lockedCountry || defaultCountry)) || COUNTRIES.find(c => c.code === 'GB') || COUNTRIES[0]
  )
  const [phoneNumber, setPhoneNumber] = useState('')
  const [hasAutoDetected, setHasAutoDetected] = useState(false)

  // Auto-detect country from IP on mount
  useEffect(() => {
    if (autoDetect && !lockedCountry && !defaultCountry && !hasAutoDetected) {
      getCountryFromIP().then(detectedCode => {
        const country = COUNTRIES.find(c => c.code === detectedCode)
        if (country) {
          setSelectedCountry(country)
          if (onCountryChange) {
            onCountryChange(country.code)
          }
        }
        setHasAutoDetected(true)
      }).catch(() => {
        setHasAutoDetected(true)
      })
    }
  }, [autoDetect, lockedCountry, defaultCountry, hasAutoDetected])

  // Update selected country if lockedCountry changes
  useEffect(() => {
    if (lockedCountry) {
      const country = COUNTRIES.find(c => c.code === lockedCountry)
      if (country) {
        setSelectedCountry(country)
        if (onCountryChange) {
          onCountryChange(country.code)
        }
      }
    }
  }, [lockedCountry])

  // Notify parent of initial country on mount
  useEffect(() => {
    if (onCountryChange) {
      onCountryChange(selectedCountry.code)
    }
  }, [])

  useEffect(() => {
    // Parse existing value if provided
    if (value) {
      const country = COUNTRIES.find(c => value.startsWith(c.dial))
      if (country) {
        setSelectedCountry(country)
        setPhoneNumber(value.slice(country.dial.length))
      }
    }
  }, [])

  const handleCountrySelect = (country) => {
    if (lockedCountry) return // Prevent change if locked
    
    setSelectedCountry(country)
    setIsOpen(false)
    
    if (onCountryChange) {
      onCountryChange(country.code)
    }
    
    if (phoneNumber) {
      onChange(country.dial + phoneNumber.replace(/\D/g, ''))
    }
  }

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '')
    setPhoneNumber(input)
    onChange(selectedCountry.dial + input)
  }

  const formatDisplayNumber = (number) => {
    if (number.length <= 3) return number
    if (number.length <= 6) return `${number.slice(0, 3)} ${number.slice(3)}`
    return `${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 10)}`
  }

  const isLocked = !!lockedCountry

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        <div className="relative">
          {isLocked ? (
            // Locked display - no dropdown
            <div className="flex items-center gap-1 px-3 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-sm text-gray-600">{selectedCountry.dial}</span>
            </div>
          ) : (
            // Unlocked - show dropdown button
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 px-3 h-10 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl hover:bg-gray-200 transition-colors"
            >
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-sm text-gray-600">{selectedCountry.dial}</span>
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {isOpen && !isLocked && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code + country.dial}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 transition-colors ${
                      selectedCountry.code === country.code ? 'bg-[#2969FF]/10' : ''
                    }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="text-sm text-gray-900 flex-1 text-left">{country.name}</span>
                    <span className="text-sm text-gray-600">{country.dial}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          type="tel"
          value={formatDisplayNumber(phoneNumber)}
          onChange={handlePhoneChange}
          placeholder="801 234 5678"
          required={required}
          className="flex-1 h-10 px-3 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2969FF]"
        />
      </div>
    </div>
  )
}
