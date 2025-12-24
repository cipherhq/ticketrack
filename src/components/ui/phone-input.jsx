import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'RW', name: 'Rwanda', dial: '+250', flag: '🇷🇼' },
  { code: 'CM', name: 'Cameroon', dial: '+237', flag: '🇨🇲' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦' },
  { code: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
]

// Export countries for use elsewhere
export { COUNTRIES }

export function PhoneInput({ 
  value, 
  onChange, 
  onCountryChange,  // New: callback when country changes
  defaultCountry = 'NG',  // New: default country code
  className = '', 
  required = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0]
  )
  const [phoneNumber, setPhoneNumber] = useState('')

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
    setSelectedCountry(country)
    setIsOpen(false)
    
    // Notify parent of country change
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

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-3 h-10 bg-[#F4F6FA] border border-r-0 border-[#0F0F0F]/10 rounded-l-xl hover:bg-[#E8EBF0] transition-colors"
          >
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-sm text-[#0F0F0F]/60">{selectedCountry.dial}</span>
            <ChevronDown className="w-4 h-4 text-[#0F0F0F]/40" />
          </button>

          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-[#0F0F0F]/10 rounded-xl shadow-lg z-20">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code + country.dial}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F4F6FA] transition-colors ${
                      selectedCountry.code === country.code ? 'bg-[#2969FF]/10' : ''
                    }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="text-sm text-[#0F0F0F] flex-1 text-left">{country.name}</span>
                    <span className="text-sm text-[#0F0F0F]/60">{country.dial}</span>
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
          className="flex-1 h-10 px-3 border border-[#0F0F0F]/10 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-[#2969FF]/20 focus:border-[#2969FF]"
        />
      </div>
    </div>
  )
}
