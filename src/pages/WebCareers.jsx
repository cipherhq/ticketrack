import { Briefcase, MapPin, Clock, Heart, Zap, Globe, Users, Rocket, Mail, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function WebCareers() {
  const benefits = [
    { icon: Globe, title: 'Remote First', description: 'Work from anywhere in the world' },
    { icon: Heart, title: 'Health Benefits', description: 'Comprehensive health coverage' },
    { icon: Zap, title: 'Learning Budget', description: 'Annual budget for courses and conferences' },
    { icon: Users, title: 'Great Team', description: 'Collaborate with talented people' },
    { icon: Rocket, title: 'Growth', description: 'Fast-growing startup environment' },
    { icon: Clock, title: 'Flexible Hours', description: 'Work when you\'re most productive' }
  ]

  const values = [
    { title: 'User Obsessed', description: 'We put our users first in every decision we make' },
    { title: 'Move Fast', description: 'We ship quickly and iterate based on feedback' },
    { title: 'Be Transparent', description: 'We communicate openly and honestly' },
    { title: 'Think Big', description: 'We\'re building the future of event ticketing in Africa and beyond' }
  ]

  const openPositions = [
    // Add actual positions when hiring
    // { title: 'Senior Frontend Engineer', department: 'Engineering', location: 'Remote', type: 'Full-time' },
    // { title: 'Product Designer', department: 'Design', location: 'Remote', type: 'Full-time' },
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Join Our Team</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Help us revolutionize event ticketing across Africa and beyond. We're building something special and we'd love for you to be part of it.
          </p>
          <a href="#positions" className="inline-flex items-center gap-2 bg-white text-[#2969FF] px-8 py-4 rounded-xl font-semibold hover:bg-white/90 transition-colors">
            View Open Positions
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* About Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">About Ticketrack</h2>
            <p className="text-[#0F0F0F]/70 mb-4">
              Ticketrack is Africa's premier event ticketing platform, helping organizers create unforgettable experiences and connecting people with events they love. We process thousands of transactions daily across multiple countries and currencies.
            </p>
            <p className="text-[#0F0F0F]/70">
              Founded with the mission to make event ticketing seamless, secure, and accessible, we're now expanding globally while keeping our roots in Africa. Our team is distributed across multiple time zones, united by our passion for building great products.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {values.map((value, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
                <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">{value.title}</h3>
                <p className="text-[#0F0F0F]/60">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6 text-center">Benefits & Perks</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 text-center">
                <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-[#2969FF]" />
                </div>
                <h3 className="font-semibold text-[#0F0F0F] mb-1">{benefit.title}</h3>
                <p className="text-[#0F0F0F]/60 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open Positions */}
        <section id="positions" className="mb-16">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6 text-center">Open Positions</h2>
          
          {openPositions.length > 0 ? (
            <div className="space-y-4">
              {openPositions.map((position, index) => (
                <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6 hover:border-[#2969FF]/30 transition-colors cursor-pointer">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#0F0F0F]">{position.title}</h3>
                      <p className="text-[#0F0F0F]/60">{position.department}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1 text-sm text-[#0F0F0F]/60">
                        <MapPin className="w-4 h-4" />
                        {position.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-[#0F0F0F]/60">
                        <Clock className="w-4 h-4" />
                        {position.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-12 text-center">
              <div className="w-16 h-16 bg-[#F4F6FA] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-[#0F0F0F]/40" />
              </div>
              <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No Open Positions Right Now</h3>
              <p className="text-[#0F0F0F]/60 mb-6 max-w-md mx-auto">
                We don't have any open positions at the moment, but we're always looking for talented people. Send us your resume and we'll keep you in mind for future opportunities.
              </p>
              <a href="mailto:careers@ticketrack.com" className="inline-flex items-center gap-2 bg-[#2969FF] text-white px-6 py-3 rounded-xl hover:bg-[#1e4fd6] transition-colors">
                <Mail className="w-5 h-5" />
                Send Your Resume
              </a>
            </div>
          )}
        </section>

        {/* CTA */}
        <section>
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#2a2a2a] rounded-2xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Don't See the Right Role?</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              We're always interested in meeting talented people. Reach out and tell us how you can contribute to our mission.
            </p>
            <a href="mailto:careers@ticketrack.com" className="inline-flex items-center gap-2 bg-white text-[#0F0F0F] px-6 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors">
              <Mail className="w-5 h-5" />
              careers@ticketrack.com
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WebCareers
