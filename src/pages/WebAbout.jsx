import { useNavigate } from 'react-router-dom'
import { Ticket, Users, Shield, Zap, Target, Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function WebAbout() {
  const navigate = useNavigate()

  const values = [
    { icon: Shield, title: 'Trust & Security', description: 'Your data and payments are protected with industry-leading security standards.' },
    { icon: Zap, title: 'Fast & Reliable', description: 'Lightning-fast ticket delivery and seamless event check-ins.' },
    { icon: Users, title: 'Community First', description: 'Connecting event organizers with passionate attendees across Africa.' },
    { icon: Target, title: 'Innovation', description: 'Constantly improving our platform with cutting-edge technology.' },
  ]

  const stats = [
    { label: 'Events Hosted', value: '50,000+' },
    { label: 'Tickets Sold', value: '2M+' },
    { label: 'Happy Customers', value: '500K+' },
    { label: 'Cities Covered', value: '100+' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-[#2969FF] rounded-2xl flex items-center justify-center">
            <Ticket className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-bold text-[#0F0F0F] mb-4">About Ticketrack</h1>
        <p className="text-xl text-[#0F0F0F]/60 max-w-3xl mx-auto">
          Africa's leading event ticketing platform, making it easy for organizers to create amazing events and for attendees to discover unforgettable experiences.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
        {stats.map((stat, index) => (
          <Card key={index} className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="text-center p-8">
              <div className="text-4xl font-bold text-[#2969FF] mb-2">{stat.value}</div>
              <div className="text-[#0F0F0F]/60">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-gradient-to-r from-[#2969FF] to-[#2969FF]/80 rounded-3xl p-12 mb-16 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
          <p className="text-xl text-white/90">
            To democratize event experiences across Africa by providing a seamless, secure, and innovative platform that empowers event organizers and delights attendees.
          </p>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-[#0F0F0F] mb-8 text-center">Our Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {values.map((value, index) => {
            const Icon = value.icon
            return (
              <Card key={index} className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#2969FF]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">{value.title}</h3>
                  <p className="text-[#0F0F0F]/60">{value.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-16">
        <h2 className="text-3xl font-bold text-[#0F0F0F] mb-6 text-center">Our Story</h2>
        <div className="space-y-4 text-[#0F0F0F]/70">
          <p>Founded in 2020, Ticketrack was born from a simple observation: attending events in Africa was often complicated by fragmented ticketing systems, payment challenges, and lack of transparency.</p>
          <p>We set out to change that. By combining local payment solutions with international best practices, we created a platform that works for everyone - from small community gatherings to large-scale festivals.</p>
          <p>Today, Ticketrack powers thousands of events across multiple African countries, helping organizers sell millions of tickets and creating memorable experiences for attendees.</p>
        </div>
      </div>

      <div className="bg-[#F4F6FA] rounded-3xl p-12 text-center">
        <Award className="w-16 h-16 text-[#2969FF] mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-[#0F0F0F] mb-4">Join the Ticketrack Community</h2>
        <p className="text-[#0F0F0F]/60 mb-8 max-w-2xl mx-auto">
          Whether you're looking to attend amazing events or create your own, we're here to help you every step of the way.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12 px-8">Browse Events</Button>
          <Button onClick={() => navigate('/organizer')} variant="outline" className="border-[#0F0F0F]/10 rounded-xl h-12 px-8">Become an Organizer</Button>
        </div>
      </div>
    </div>
  )
}
