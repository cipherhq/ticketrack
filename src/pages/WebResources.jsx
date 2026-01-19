import { BookOpen, TrendingUp, Users, Megaphone, Calendar, DollarSign, Shield, Zap, ArrowRight, Download, PlayCircle, Globe, CreditCard, Smartphone, QrCode, Mail, FileText, Code, Settings, HelpCircle, Link as LinkIcon, CheckCircle2, Ticket, BarChart3, Sparkles, Building, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { currencies } from '@/config/currencies'

export function WebResources() {
  // Platform Overview
  const platformFeatures = [
    { icon: Calendar, title: 'Event Management', description: 'Create unlimited events with custom branding, multi-day support, and recurring event series.' },
    { icon: Ticket, title: 'Smart Ticketing', description: 'Multiple ticket types, dynamic pricing, capacity management, and waitlist functionality.' },
    { icon: CreditCard, title: 'Multi-Payment Support', description: 'Accept payments via cards, bank transfers, mobile money, and USSD across 5+ currencies.' },
    { icon: BarChart3, title: 'Real-time Analytics', description: 'Track sales, revenue, attendee demographics, and performance metrics in real-time.' },
    { icon: QrCode, title: 'QR Code Check-in', description: 'Fast, seamless check-in with QR codes. Works offline and supports thousands of attendees.' },
    { icon: Users, title: 'Attendee Management', description: 'Manage waitlists, send communications, handle refunds, and track attendance.' },
    { icon: Sparkles, title: 'AI-Powered Tools', description: 'Generate event descriptions, email campaigns, and social posts with AI assistance.' },
    { icon: Shield, title: 'Security & Compliance', description: 'PCI-DSS compliant payment processing with industry-leading security standards.' },
    { icon: DollarSign, title: 'Revenue Management', description: 'Track payouts, manage subaccounts, handle taxes, and process refunds seamlessly.' },
    { icon: Megaphone, title: 'Marketing Tools', description: 'Promoter tracking, commission management, email campaigns, SMS, and WhatsApp integration.' },
    { icon: Building, title: 'Venue Management', description: 'Design custom venue layouts with 2D floor plans and manage multiple venues.' },
    { icon: Globe, title: 'Multi-Country Support', description: 'Host events in Nigeria, Ghana, US, UK, Canada with local payment methods and currencies.' },
  ]

  // Supported Currencies & Payment Methods
  const supportedCurrencies = Object.values(currencies).map(curr => ({
    ...curr,
    methods: curr.paymentProvider === 'paystack' 
      ? ['Card', 'Bank Transfer', 'USSD', 'Mobile Money', 'Bank Account']
      : ['Card', 'Apple Pay', 'Google Pay', 'Bank Transfer']
  }))

  // Supported Countries
  const supportedCountries = [
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', provider: 'Paystack / Flutterwave' },
    { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', provider: 'Paystack / Flutterwave' },
    { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', provider: 'Stripe' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', provider: 'Stripe' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', provider: 'Stripe' },
  ]

  // Organizer Guides
  const guides = [
    {
      icon: Calendar,
      title: 'Getting Started with Event Creation',
      description: 'Learn how to create your first event, set up ticket types, and configure event details from start to finish.',
      category: 'Getting Started',
      readTime: '12 min read',
      topics: ['Creating events', 'Ticket types', 'Event settings', 'Publishing events'],
      link: '/help-center#creating-events'
    },
    {
      icon: DollarSign,
      title: 'Pricing Strategy & Revenue Optimization',
      description: 'Master pricing strategies to maximize attendance and revenue. Learn about dynamic pricing, early bird discounts, and fee management.',
      category: 'Revenue',
      readTime: '15 min read',
      topics: ['Pricing strategies', 'Fee management', 'Early bird pricing', 'Dynamic pricing'],
      link: '/help-center#pricing'
    },
    {
      icon: Megaphone,
      title: 'Event Marketing & Promotion',
      description: 'Proven strategies to promote your events, reach your target audience, and sell more tickets using Ticketrack\'s marketing tools.',
      category: 'Marketing',
      readTime: '18 min read',
      topics: ['Email campaigns', 'Social media', 'Promoter management', 'AI marketing tools'],
      link: '/help-center#marketing'
    },
    {
      icon: Users,
      title: 'Building & Managing Your Audience',
      description: 'Grow your attendee base, build a loyal community, and leverage follower management features to boost event attendance.',
      category: 'Growth',
      readTime: '10 min read',
      topics: ['Follower management', 'Audience building', 'Community engagement', 'Retention strategies'],
      link: '/help-center#audience'
    },
    {
      icon: Shield,
      title: 'Event Safety & Security Best Practices',
      description: 'Essential safety guidelines, security measures, and compliance requirements to protect your attendees and ensure smooth operations.',
      category: 'Operations',
      readTime: '8 min read',
      topics: ['Safety protocols', 'Security measures', 'Check-in procedures', 'Incident management'],
      link: '/help-center#safety'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Performance Optimization',
      description: 'Use data-driven insights to improve your events, understand attendee behavior, and increase ROI with comprehensive analytics.',
      category: 'Analytics',
      readTime: '12 min read',
      topics: ['Analytics dashboard', 'Sales metrics', 'Attendee insights', 'Performance tracking'],
      link: '/help-center#analytics'
    },
    {
      icon: CreditCard,
      title: 'Payment Processing & Payout Management',
      description: 'Understand payment gateways, payout schedules, subaccount management, and how to handle refunds efficiently.',
      category: 'Finance',
      readTime: '14 min read',
      topics: ['Payment gateways', 'Payout setup', 'Subaccounts', 'Refund processing'],
      link: '/help-center#payments'
    },
    {
      icon: QrCode,
      title: 'Check-in & Attendance Management',
      description: 'Set up seamless check-in processes, use QR codes effectively, and manage large crowds efficiently on event day.',
      category: 'Operations',
      readTime: '9 min read',
      topics: ['QR check-in', 'Mobile app', 'Offline mode', 'Attendee verification'],
      link: '/help-center#checkin'
    },
    {
      icon: Building,
      title: 'Venue Layout Design & Management',
      description: 'Create custom venue layouts, design seating arrangements, and manage multiple venues for your events.',
      category: 'Venue',
      readTime: '11 min read',
      topics: ['Layout designer', 'Seating charts', 'Venue management', '2D floor plans'],
      link: '/help-center#venue'
    },
    {
      icon: RefreshCw,
      title: 'Refund & Cancellation Management',
      description: 'Handle refund requests, manage cancellations, set refund policies, and process automatic refunds when needed.',
      category: 'Operations',
      readTime: '7 min read',
      topics: ['Refund policies', 'Cancellation handling', 'Auto-refunds', 'Refund requests'],
      link: '/help-center#refunds'
    },
  ]

  // Quick Tips
  const quickTips = [
    'Start promoting your event at least 4-6 weeks in advance for maximum reach',
    'Use early bird pricing to drive initial sales momentum and create urgency',
    'Include clear, high-quality event photos and compelling descriptions',
    'Respond to attendee questions and messages within 24 hours',
    'Send reminder emails 1 week and 1 day before the event to reduce no-shows',
    'Collect feedback after every event to continuously improve future events',
    'Set up waitlists for sold-out events to capture additional demand',
    'Use QR codes for fast, contactless check-in at your events',
    'Leverage AI-powered tools to generate marketing content and save time',
    'Monitor analytics regularly to understand what works and optimize accordingly',
    'Set clear refund policies upfront to manage expectations',
    'Build your follower base by engaging with your audience consistently',
  ]

  // Developer Resources
  const developerResources = [
    {
      icon: Code,
      title: 'API Documentation',
      description: 'Access our REST API documentation for integrating Ticketrack into your applications.',
      comingSoon: false,
      link: 'https://docs.ticketrack.com/api'
    },
    {
      icon: Settings,
      title: 'Webhooks',
      description: 'Set up webhooks to receive real-time notifications for events, orders, and payments.',
      comingSoon: false,
      link: 'https://docs.ticketrack.com/webhooks'
    },
    {
      icon: LinkIcon,
      title: 'Payment Gateway Integration',
      description: 'Learn how to integrate Paystack, Stripe, and Flutterwave payment gateways.',
      comingSoon: false,
      link: 'https://docs.ticketrack.com/integrations'
    },
    {
      icon: Smartphone,
      title: 'Mobile SDK',
      description: 'SDKs for iOS and Android to build custom mobile experiences.',
      comingSoon: true,
    },
  ]

  // Tools & Templates
  const featuredTools = [
    {
      title: 'Event Revenue Calculator',
      description: 'Estimate your revenue based on ticket prices, expected attendance, and fee structures.',
      icon: DollarSign,
      comingSoon: true
    },
    {
      title: 'Event Planning Checklist',
      description: 'Downloadable comprehensive checklist to keep your event planning on track from start to finish.',
      icon: Download,
      comingSoon: true
    },
    {
      title: 'Marketing Calendar Template',
      description: 'Plan your promotional activities with our marketing timeline template and schedule.',
      icon: Calendar,
      comingSoon: true
    },
    {
      title: 'Pricing Strategy Template',
      description: 'Use our pricing strategy template to plan ticket tiers and maximize revenue.',
      icon: TrendingUp,
      comingSoon: true
    },
  ]

  // FAQ Categories
  const faqCategories = [
    { title: 'Getting Started', count: 8, link: '/help#getting-started' },
    { title: 'Event Creation', count: 12, link: '/help#event-creation' },
    { title: 'Ticketing', count: 10, link: '/help#ticketing' },
    { title: 'Payments', count: 9, link: '/help#payments' },
    { title: 'Check-in', count: 6, link: '/help#checkin' },
    { title: 'Refunds', count: 7, link: '/help#refunds' },
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Resources</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Comprehensive guides, documentation, and tools to help you create successful events and grow your audience.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Platform Features Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Platform Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="bg-white rounded-xl border border-[#0F0F0F]/10 p-4 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-[#2969FF]/10 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-[#2969FF]" />
                  </div>
                  <h3 className="font-semibold text-[#0F0F0F] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#0F0F0F]/60">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Supported Countries & Currencies */}
        <section className="mb-12">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-6 h-6 text-[#2969FF]" />
                <h2 className="text-xl font-bold text-[#0F0F0F]">Supported Countries</h2>
              </div>
              <div className="space-y-3">
                {supportedCountries.map((country, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country.flag}</span>
                      <div>
                        <div className="font-medium text-[#0F0F0F]">{country.name}</div>
                        <div className="text-xs text-[#0F0F0F]/60">{country.currency} • {country.provider}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-[#2969FF]" />
                <h2 className="text-xl font-bold text-[#0F0F0F]">Payment Methods</h2>
              </div>
              <div className="space-y-3">
                {supportedCurrencies.map((currency, index) => (
                  <div key={index} className="p-3 bg-[#F4F6FA] rounded-lg">
                    <div className="font-medium text-[#0F0F0F] mb-2">{currency.name} ({currency.code})</div>
                    <div className="flex flex-wrap gap-2">
                      {currency.methods.map((method, idx) => (
                        <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-[#0F0F0F]/10">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Tips */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="w-6 h-6 text-amber-600" />
              <h2 className="text-xl font-bold text-[#0F0F0F]">Quick Tips for Success</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {quickTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-[#0F0F0F]/70 text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guides */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#0F0F0F]">Organizer Guides</h2>
            <Link to="/help-center" className="text-[#2969FF] hover:underline text-sm font-medium">
              View All Help Articles <ArrowRight className="w-4 h-4 inline ml-1" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {guides.map((guide, index) => {
              const Icon = guide.icon
              return (
                <Link 
                  key={index} 
                  to={guide.link}
                  className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 hover:border-[#2969FF]/30 hover:shadow-md transition-all cursor-pointer group"
                >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#2969FF]/20 transition-colors">
                      <Icon className="w-6 h-6 text-[#2969FF]" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-[#2969FF] uppercase tracking-wide">{guide.category}</span>
                    <h3 className="text-lg font-semibold text-[#0F0F0F] mt-1 mb-2 group-hover:text-[#2969FF] transition-colors">{guide.title}</h3>
                    <p className="text-[#0F0F0F]/60 text-sm mb-3">{guide.description}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {guide.topics.slice(0, 3).map((topic, idx) => (
                          <span key={idx} className="text-xs bg-[#F4F6FA] text-[#0F0F0F]/60 px-2 py-1 rounded">
                            {topic}
                          </span>
                        ))}
                        {guide.topics.length > 3 && (
                          <span className="text-xs text-[#0F0F0F]/40 px-2 py-1">+{guide.topics.length - 3} more</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                    <span className="text-xs text-[#0F0F0F]/40">{guide.readTime}</span>
                        <ArrowRight className="w-4 h-4 text-[#2969FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Developer Resources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Developer Resources</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {developerResources.map((resource, index) => {
              const Icon = resource.icon
              const content = (
                <div className={`bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 ${resource.link ? 'hover:shadow-md transition-shadow cursor-pointer group' : ''} ${resource.comingSoon ? 'opacity-60' : ''}`}>
                  {resource.comingSoon && (
                    <span className="inline-block bg-[#F4F6FA] text-[#0F0F0F]/50 text-xs px-2 py-1 rounded-full mb-3">
                      Coming Soon
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#2969FF]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#0F0F0F] mb-2">{resource.title}</h3>
                      <p className="text-[#0F0F0F]/60 text-sm">{resource.description}</p>
                      {resource.link && (
                        <div className="mt-3 flex items-center gap-2 text-[#2969FF] text-sm font-medium">
                          <span>View Documentation</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
              return resource.link && !resource.comingSoon ? (
                <a key={index} href={resource.link} target="_blank" rel="noopener noreferrer" className="block">
                  {content}
                </a>
              ) : (
                <div key={index}>{content}</div>
              )
            })}
          </div>
        </section>

        {/* Tools & Templates */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Tools & Templates</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredTools.map((tool, index) => {
              const Icon = tool.icon
              return (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 relative overflow-hidden">
                {tool.comingSoon && (
                  <span className="absolute top-3 right-3 bg-[#F4F6FA] text-[#0F0F0F]/50 text-xs px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
                <div className="w-10 h-10 bg-[#F4F6FA] rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#0F0F0F]/60" />
                </div>
                <h3 className="font-semibold text-[#0F0F0F] mb-2">{tool.title}</h3>
                <p className="text-[#0F0F0F]/60 text-sm">{tool.description}</p>
              </div>
              )
            })}
          </div>
        </section>

        {/* FAQ Categories */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {faqCategories.map((category, index) => (
              <Link
                key={index}
                to={category.link}
                className="bg-white rounded-xl border border-[#0F0F0F]/10 p-4 hover:border-[#2969FF]/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[#0F0F0F] group-hover:text-[#2969FF] transition-colors">{category.title}</h3>
                  <ArrowRight className="w-4 h-4 text-[#2969FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm text-[#0F0F0F]/60">{category.count} articles</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Help Center CTA */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <PlayCircle className="w-8 h-8 text-[#2969FF]" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Need Step-by-Step Help?</h3>
              <p className="text-[#0F0F0F]/60">
                Our Help Center has detailed instructions for every feature on Ticketrack, with searchable articles and video tutorials.
              </p>
            </div>
            <Link to="/help-center" className="inline-flex items-center gap-2 bg-[#2969FF] text-white px-6 py-3 rounded-xl hover:bg-[#1e4fd6] transition-colors whitespace-nowrap">
              Visit Help Center
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section>
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#2a2a2a] rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Have Questions?</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Our support team is here to help you succeed. Reach out anytime via email, chat, or phone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="inline-flex items-center gap-2 bg-white text-[#0F0F0F] px-6 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors">
              Contact Us
              <ArrowRight className="w-5 h-5" />
            </Link>
              <a href="mailto:support@ticketrack.com" className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors">
                <Mail className="w-5 h-5" />
                support@ticketrack.com
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WebResources
