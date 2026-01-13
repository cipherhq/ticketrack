import { Shield, Lock, Eye, Users, AlertTriangle, CheckCircle, CreditCard, FileText, Mail, Phone } from 'lucide-react'

export function WebTrustSafety() {
  const safeguards = [
    {
      icon: Lock,
      title: 'Secure Payments',
      description: 'All transactions are processed through PCI-DSS compliant payment providers including Paystack, Stripe, and PayPal. Your payment details are never stored on our servers.',
      color: 'bg-blue-500'
    },
    {
      icon: Shield,
      title: 'Verified Organizers',
      description: 'We verify organizer identities through our KYC (Know Your Customer) process. Look for the verified badge on organizer profiles.',
      color: 'bg-green-500'
    },
    {
      icon: Eye,
      title: 'Fraud Detection',
      description: 'Our systems monitor for suspicious activity 24/7. We use advanced algorithms to detect and prevent fraudulent events and transactions.',
      color: 'bg-purple-500'
    },
    {
      icon: CreditCard,
      title: 'Buyer Protection',
      description: 'If an event is cancelled, you\'ll receive a full refund including service fees. We hold organizer funds until events are completed.',
      color: 'bg-orange-500'
    }
  ]

  const attendeeGuidelines = [
    'Only purchase tickets from the official Ticketrack platform',
    'Verify the event details and organizer information before buying',
    'Keep your account credentials secure and never share them',
    'Report suspicious events or messages immediately',
    'Save your confirmation emails and ticket QR codes',
    'Check the refund policy before purchasing'
  ]

  const organizerGuidelines = [
    'Provide accurate and complete event information',
    'Respond promptly to attendee inquiries',
    'Honor your stated refund policy',
    'Complete identity verification for faster payouts',
    'Keep attendee data confidential and secure',
    'Report any suspicious activity to our team'
  ]

  const prohibitedActivities = [
    { activity: 'Ticket Scalping', description: 'Reselling tickets above face value is prohibited' },
    { activity: 'Fake Events', description: 'Creating events with no intention of hosting them' },
    { activity: 'Account Fraud', description: 'Using fake identities or stolen payment methods' },
    { activity: 'Harassment', description: 'Threatening or harassing other users' },
    { activity: 'Spam', description: 'Sending unsolicited messages or promotions' },
    { activity: 'Data Scraping', description: 'Automated collection of user or event data' }
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <Shield className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Trust & Safety</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Your safety is our priority. Learn how we protect our community and what you can do to stay safe.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Safeguards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">How We Protect You</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {safeguards.map((item, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-4`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">{item.title}</h3>
                <p className="text-[#0F0F0F]/60">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Guidelines */}
        <section className="mb-12">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-[#2969FF]" />
                <h3 className="text-lg font-semibold text-[#0F0F0F]">For Attendees</h3>
              </div>
              <ul className="space-y-3">
                {attendeeGuidelines.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-[#0F0F0F]/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-[#2969FF]" />
                <h3 className="text-lg font-semibold text-[#0F0F0F]">For Organizers</h3>
              </div>
              <ul className="space-y-3">
                {organizerGuidelines.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-[#0F0F0F]/70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Prohibited Activities */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Prohibited Activities</h2>
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
            <div className="grid md:grid-cols-2 gap-4">
              {prohibitedActivities.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-[#0F0F0F]">{item.activity}</h4>
                    <p className="text-sm text-[#0F0F0F]/60">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Report Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-[#2969FF]/10 to-[#2969FF]/5 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Report a Problem</h2>
            <p className="text-[#0F0F0F]/70 mb-6">
              If you encounter suspicious activity, fraudulent events, or any safety concerns, please report it immediately. We take all reports seriously and investigate promptly.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="mailto:safety@ticketrack.com" className="inline-flex items-center gap-2 bg-[#2969FF] text-white px-6 py-3 rounded-xl hover:bg-[#1e4fd6] transition-colors">
                <Mail className="w-5 h-5" />
                safety@ticketrack.com
              </a>
              <a href="/contact" className="inline-flex items-center gap-2 bg-white text-[#0F0F0F] px-6 py-3 rounded-xl border border-[#0F0F0F]/10 hover:bg-[#F4F6FA] transition-colors">
                <Phone className="w-5 h-5" />
                Contact Support
              </a>
            </div>
          </div>
        </section>

        {/* Data Protection */}
        <section>
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Data Protection</h2>
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
            <p className="text-[#0F0F0F]/70 mb-4">
              We are committed to protecting your personal data in compliance with applicable data protection laws including NDPR (Nigeria Data Protection Regulation) and GDPR.
            </p>
            <ul className="space-y-2 text-[#0F0F0F]/70">
              <li>• Your data is encrypted in transit and at rest</li>
              <li>• We never sell your personal information to third parties</li>
              <li>• You can request deletion of your account and data at any time</li>
              <li>• We only collect data necessary to provide our services</li>
            </ul>
            <a href="/privacy" className="inline-flex items-center gap-2 text-[#2969FF] mt-4 hover:underline">
              Read our full Privacy Policy →
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WebTrustSafety
