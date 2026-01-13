import { BookOpen, TrendingUp, Users, Megaphone, Calendar, DollarSign, Shield, Zap, ArrowRight, Download, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function WebResources() {
  const guides = [
    {
      icon: Calendar,
      title: 'Event Planning 101',
      description: 'Everything you need to know to plan and execute a successful event from start to finish.',
      category: 'Getting Started',
      readTime: '10 min read',
      link: '#'
    },
    {
      icon: DollarSign,
      title: 'Pricing Your Tickets',
      description: 'Learn how to price your event tickets for maximum attendance and revenue.',
      category: 'Revenue',
      readTime: '8 min read',
      link: '#'
    },
    {
      icon: Megaphone,
      title: 'Marketing Your Event',
      description: 'Proven strategies to promote your event and sell more tickets.',
      category: 'Marketing',
      readTime: '12 min read',
      link: '#'
    },
    {
      icon: Users,
      title: 'Building Your Audience',
      description: 'How to grow your attendee base and create a loyal community around your events.',
      category: 'Growth',
      readTime: '7 min read',
      link: '#'
    },
    {
      icon: Shield,
      title: 'Event Safety Best Practices',
      description: 'Essential safety guidelines to protect your attendees and ensure smooth operations.',
      category: 'Operations',
      readTime: '6 min read',
      link: '#'
    },
    {
      icon: TrendingUp,
      title: 'Analyzing Event Performance',
      description: 'Use data to improve your future events and increase ROI.',
      category: 'Analytics',
      readTime: '9 min read',
      link: '#'
    }
  ]

  const quickTips = [
    'Start promoting your event at least 4-6 weeks in advance',
    'Use early bird pricing to drive initial sales momentum',
    'Include clear event photos and descriptions',
    'Respond to attendee questions within 24 hours',
    'Send reminder emails 1 week and 1 day before the event',
    'Collect feedback after every event to improve'
  ]

  const featuredTools = [
    {
      title: 'Ticket Sales Calculator',
      description: 'Estimate your revenue based on ticket prices and expected attendance',
      icon: DollarSign,
      comingSoon: true
    },
    {
      title: 'Event Checklist Template',
      description: 'Downloadable checklist to keep your event planning on track',
      icon: Download,
      comingSoon: true
    },
    {
      title: 'Marketing Calendar',
      description: 'Plan your promotional activities with our marketing timeline template',
      icon: Calendar,
      comingSoon: true
    }
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Resources</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Guides, tips, and tools to help you create successful events and grow your audience.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Tips */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-amber-600" />
              <h2 className="text-xl font-bold text-[#0F0F0F]">Quick Tips for Success</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {quickTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
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
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Organizer Guides</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {guides.map((guide, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 hover:border-[#2969FF]/30 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#2969FF]/20 transition-colors">
                    <guide.icon className="w-6 h-6 text-[#2969FF]" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-[#2969FF] uppercase tracking-wide">{guide.category}</span>
                    <h3 className="text-lg font-semibold text-[#0F0F0F] mt-1 mb-2 group-hover:text-[#2969FF] transition-colors">{guide.title}</h3>
                    <p className="text-[#0F0F0F]/60 text-sm mb-3">{guide.description}</p>
                    <span className="text-xs text-[#0F0F0F]/40">{guide.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[#0F0F0F]/50 mt-6 text-sm">More guides coming soon...</p>
        </section>

        {/* Tools */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Tools & Templates</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {featuredTools.map((tool, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 relative overflow-hidden">
                {tool.comingSoon && (
                  <span className="absolute top-3 right-3 bg-[#F4F6FA] text-[#0F0F0F]/50 text-xs px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
                <div className="w-10 h-10 bg-[#F4F6FA] rounded-xl flex items-center justify-center mb-4">
                  <tool.icon className="w-5 h-5 text-[#0F0F0F]/60" />
                </div>
                <h3 className="font-semibold text-[#0F0F0F] mb-2">{tool.title}</h3>
                <p className="text-[#0F0F0F]/60 text-sm">{tool.description}</p>
              </div>
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
                Our Help Center has detailed instructions for every feature on Ticketrack.
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
              Our team is here to help you succeed. Reach out anytime.
            </p>
            <Link to="/contact" className="inline-flex items-center gap-2 bg-white text-[#0F0F0F] px-6 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors">
              Contact Us
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WebResources
