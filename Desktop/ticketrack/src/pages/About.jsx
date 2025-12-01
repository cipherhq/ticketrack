import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Shield, Zap, Globe, Users, Award, Heart } from 'lucide-react'

export default function About() {
  const team = [
    { name: 'Babajide', role: 'Founder & CEO', image: null },
  ]

  const stats = [
    { label: 'Countries', value: '6' },
    { label: 'Events Hosted', value: '1,000+' },
    { label: 'Tickets Sold', value: '50,000+' },
    { label: 'Happy Customers', value: '25,000+' },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About Ticketrack</h1>
          <p className="text-xl text-primary-100 max-w-2xl mx-auto">
            We're on a mission to make event ticketing seamless, secure, and accessible across Africa.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-gray-600 mb-4">
                Ticketrack was founded with a simple goal: to become the best event ticketing platform in Africa. 
                We believe everyone deserves access to amazing events, and organizers deserve a reliable platform 
                to sell their tickets.
              </p>
              <p className="text-gray-600 mb-4">
                We've built our platform with security at its core, supporting multiple currencies across 
                Nigeria, Ghana, Kenya, Rwanda, South Africa, and Cameroon.
              </p>
              <p className="text-gray-600">
                Our low 10% platform fee ensures organizers keep more of their earnings while attendees 
                enjoy a seamless ticket purchasing experience.
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl h-80 flex items-center justify-center">
              <span className="text-8xl">🎫</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-primary-500">{stat.value}</p>
                <p className="text-gray-600 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 text-center">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Security First</h3>
              <p className="text-gray-600">Bank-level encryption and secure payment processing for every transaction.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Globe className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pan-African</h3>
              <p className="text-gray-600">Built for Africa, supporting local currencies and payment methods.</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Customer Love</h3>
              <p className="text-gray-600">We're obsessed with creating the best experience for our users.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-500 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join Us?</h2>
          <p className="text-primary-100 mb-8">
            Whether you're an event organizer or attendee, we'd love to have you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="secondary" size="lg" className="bg-white text-primary-500 hover:bg-gray-100 border-0">
                Get Started
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-primary-500">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
