import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Cookie, X, Settings, Shield } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'ticketrack_cookie_consent'
const COOKIE_PREFERENCES_KEY = 'ticketrack_cookie_preferences'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    essential: true, // Always required
    analytics: false,
    marketing: false,
    functional: true,
  })

  useEffect(() => {
    // Check if consent has been given
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Delay showing banner for better UX
      setTimeout(() => setShowBanner(true), 1000)
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY)
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs))
      }
    }
  }, [])

  const acceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
    }
    saveConsent(allAccepted)
  }

  const acceptEssential = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false,
      functional: true,
    }
    saveConsent(essentialOnly)
  }

  const savePreferences = () => {
    saveConsent(preferences)
  }

  const saveConsent = (prefs) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs))
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setPreferences(prefs)
    setShowBanner(false)
    setShowSettings(false)

    // Dispatch event for analytics scripts to listen to
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: prefs }))
  }

  if (!showBanner) return null

  return (
    <>
      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 bg-white dark:bg-[#1E1E1E] border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">We value your privacy</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                  By clicking "Accept All", you consent to our use of cookies as described in our{' '}
                  <a href="/privacy" className="text-[#2969FF] hover:underline">Privacy Policy</a> and{' '}
                  <a href="/cookies" className="text-[#2969FF] hover:underline">Cookie Policy</a>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowSettings(true)}
                className="flex-1 lg:flex-none rounded-xl text-sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                Customize
              </Button>
              <Button
                variant="outline"
                onClick={acceptEssential}
                className="flex-1 lg:flex-none rounded-xl text-sm"
              >
                Essential Only
              </Button>
              <Button
                onClick={acceptAll}
                className="flex-1 lg:flex-none bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl text-sm"
              >
                Accept All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#2969FF]/10 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#2969FF]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Cookie Preferences</h2>
                    <p className="text-sm text-muted-foreground">Manage your cookie settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-[#0F0F0F]/5 rounded-lg"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-foreground">Essential Cookies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for the website to function. These cannot be disabled.
                  </p>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-6 bg-[#2969FF] rounded-full flex items-center justify-end px-1">
                    <div className="w-4 h-4 bg-card rounded-full" />
                  </div>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-foreground">Functional Cookies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enable personalized features like saved preferences and language settings.
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, functional: !p.functional }))}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                    preferences.functional ? 'bg-[#2969FF] justify-end' : 'bg-[#0F0F0F]/20 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-card rounded-full" />
                </button>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-foreground">Analytics Cookies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Help us understand how visitors interact with our website to improve it.
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                    preferences.analytics ? 'bg-[#2969FF] justify-end' : 'bg-[#0F0F0F]/20 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-card rounded-full" />
                </button>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-foreground">Marketing Cookies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used to deliver relevant advertisements and track their effectiveness.
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, marketing: !p.marketing }))}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                    preferences.marketing ? 'bg-[#2969FF] justify-end' : 'bg-[#0F0F0F]/20 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-card rounded-full" />
                </button>
              </div>

              {/* GDPR Info */}
              <div className="bg-muted rounded-xl p-4 text-sm text-foreground/70">
                <p className="font-medium text-foreground mb-2">Your Privacy Rights (GDPR/UK GDPR)</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>You can withdraw consent at any time</li>
                  <li>You can request access to your personal data</li>
                  <li>You can request deletion of your data</li>
                  <li>You can export your data</li>
                </ul>
                <a href="/privacy" className="text-[#2969FF] hover:underline mt-2 inline-block">
                  Read our full Privacy Policy →
                </a>
              </div>
            </div>

            <div className="p-6 border-t border-border/10 flex gap-3">
              <Button
                variant="outline"
                onClick={acceptEssential}
                className="flex-1 rounded-xl"
              >
                Essential Only
              </Button>
              <Button
                onClick={savePreferences}
                className="flex-1 bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Utility function to check if a cookie type is allowed
export function isCookieAllowed(type) {
  const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY)
  if (!prefs) return false
  const preferences = JSON.parse(prefs)
  return preferences[type] === true
}

// Utility to get all cookie preferences
export function getCookiePreferences() {
  const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY)
  if (!prefs) return null
  return JSON.parse(prefs)
}
