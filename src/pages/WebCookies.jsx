import { Cookie, Shield, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WebCookies() {
  const sections = [
    { 
      title: '1. What Are Cookies?', 
      content: [
        'Cookies are small text files stored on your device when you visit websites.',
        'They help websites remember your preferences and improve your experience.',
        'Cookies can be "session" (deleted when you close your browser) or "persistent" (remain until they expire or you delete them).',
      ]
    },
    { 
      title: '2. Essential Cookies (Required)', 
      content: [
        'Authentication cookies that keep you logged in securely.',
        'Security cookies that protect against fraud and unauthorized access.',
        'Session cookies that remember your cart and checkout progress.',
        'These cookies are necessary for the website to function and cannot be disabled.',
      ]
    },
    { 
      title: '3. Functional Cookies', 
      content: [
        'Remember your language and region preferences.',
        'Store your display preferences (dark mode, layout).',
        'Remember form data to save you time.',
        'You can disable these, but some features may not work properly.',
      ]
    },
    { 
      title: '4. Analytics Cookies', 
      content: [
        'Help us understand how visitors use our website.',
        'Measure page views, session duration, and user journeys.',
        'Identify popular content and areas for improvement.',
        'We use aggregated, anonymized data where possible.',
        'Analytics cookies require your consent under GDPR/UK GDPR.',
      ]
    },
    { 
      title: '5. Marketing Cookies', 
      content: [
        'Used to deliver relevant advertisements on other platforms.',
        'Track the effectiveness of our marketing campaigns.',
        'Help us reach people who may be interested in our events.',
        'Marketing cookies require your explicit consent under GDPR/UK GDPR.',
        'You can withdraw consent at any time via our cookie settings.',
      ]
    },
    { 
      title: '6. Third-Party Cookies', 
      content: [
        'Payment processors (Stripe, Paystack, PayPal) may set cookies to process transactions securely.',
        'Social media plugins may set cookies if you interact with share buttons.',
        'Analytics services (if enabled) may set tracking cookies.',
        'These third parties have their own privacy policies governing their cookies.',
      ]
    },
    { 
      title: '7. Managing Cookies', 
      content: [
        'Cookie Banner: Use our cookie consent banner to manage preferences when you first visit.',
        'Cookie Settings: Click the "Cookie Preferences" button below to change your choices anytime.',
        'Browser Settings: Most browsers let you block or delete cookies in their settings.',
        'Opt-out Links: Use industry opt-out tools like YourAdChoices or NAI opt-out.',
      ]
    },
    { 
      title: '8. Your Rights (GDPR/UK GDPR)', 
      content: [
        'You have the right to accept or reject non-essential cookies.',
        'We will not set analytics or marketing cookies without your consent.',
        'You can withdraw consent at any time without affecting prior processing.',
        'Essential cookies do not require consent as they are necessary for the service.',
      ]
    },
    { 
      title: '9. Cookie Retention', 
      content: [
        'Session cookies: Deleted when you close your browser.',
        'Authentication cookies: Up to 30 days (or until you log out).',
        'Preference cookies: Up to 1 year.',
        'Analytics cookies: Up to 2 years (if consented).',
        'Marketing cookies: Up to 1 year (if consented).',
      ]
    },
    { 
      title: '10. Updates to This Policy', 
      content: [
        'We may update this Cookie Policy to reflect changes in our practices or legal requirements.',
        'Significant changes will be communicated via our website or email.',
        'The "Last updated" date at the top indicates when the policy was last revised.',
      ]
    },
  ]

  const openCookieSettings = () => {
    // Clear consent to re-show the banner
    localStorage.removeItem('ticketrack_cookie_consent')
    window.location.reload()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center">
            <Cookie className="w-8 h-8 text-[#2969FF]" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: January 20, 2026</p>
      </div>

      <div className="bg-card rounded-2xl border border-border/10 p-8 mb-8">
        <p className="text-foreground/70 leading-relaxed">
          This Cookie Policy explains how Ticketrack ("we", "us", or "our") uses cookies and similar technologies 
          when you visit our website. We are committed to being transparent about the technologies we use and 
          giving you control over your privacy in accordance with GDPR and UK GDPR.
        </p>
      </div>

      {/* Cookie Settings Button */}
      <div className="bg-[#2969FF]/5 border border-[#2969FF]/20 rounded-2xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#2969FF]" />
            <div>
              <p className="font-medium text-foreground">Manage Your Cookie Preferences</p>
              <p className="text-sm text-muted-foreground">Change your cookie settings at any time</p>
            </div>
          </div>
          <Button onClick={openCookieSettings} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
            <Settings className="w-4 h-4 mr-2" />
            Cookie Settings
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {sections.map((section, index) => (
          <div key={index} className="bg-card rounded-2xl border border-border/10 p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">{section.title}</h2>
            <ul className="space-y-3">
              {section.content.map((item, itemIndex) => (
                <li key={itemIndex} className="text-foreground/70 leading-relaxed flex items-start gap-3">
                  <span className="w-1.5 h-1.5 bg-[#2969FF] rounded-full mt-2 flex-shrink-0"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* GDPR Summary Box */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mt-8">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Your Privacy Rights</h3>
            <div className="text-foreground/70 space-y-2">
              <p>Under GDPR and UK GDPR, you have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Accept or reject non-essential cookies</li>
                <li>Withdraw consent at any time</li>
                <li>Request information about cookies we use</li>
                <li>Lodge a complaint with your local supervisory authority</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-2xl p-8 mt-8 text-center">
        <h3 className="text-xl font-semibold text-foreground mb-4">Questions About Cookies?</h3>
        <p className="text-foreground/70 mb-4">If you have questions about our use of cookies, please contact us:</p>
        <p className="text-[#2969FF] font-medium">privacy@ticketrack.com</p>
        <p className="text-foreground/70 mt-2">Ticketrack Ltd</p>
      </div>
    </div>
  )
}
