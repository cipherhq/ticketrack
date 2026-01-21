import { useState, useEffect } from 'react'
import { Mail, Phone, MapPin, Send, MessageSquare, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getContactInfo } from '@/services/settings'

export function WebContact() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [contact, setContact] = useState({
    email: 'support@ticketrack.com',
    phone: '+1 (800) TICKETS'
  })

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const info = await getContactInfo()
        setContact(info)
      } catch (err) {
        console.warn('Failed to fetch contact info')
      }
    }
    fetchContact()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); setFormData({ name: '', email: '', subject: '', message: '' }) }, 3000)
  }

  const contactInfo = [
    { icon: Mail, title: 'Email Us', details: [contact.email] },
    { icon: Phone, title: 'Call Us', details: [contact.phone] },
    { icon: MapPin, title: 'Visit Us', details: ['Remote-first Company', 'Operating Globally'] },
    { icon: Clock, title: 'Working Hours', details: ['Monday - Friday: 9AM - 6PM (GMT)', '24/7 Online Support'] },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-[#2969FF]" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Get in Touch</h1>
        <p className="text-xl text-[#0F0F0F]/60 max-w-2xl mx-auto">Have a question or need help? We're here to assist you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        <div className="lg:col-span-2">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Send us a Message</CardTitle></CardHeader>
            <CardContent>
              {submitted ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-4"><Send className="w-8 h-8 text-[#2969FF]" /></div>
                  <h3 className="text-2xl font-semibold text-[#0F0F0F] mb-2">Message Sent!</h3>
                  <p className="text-[#0F0F0F]/60">Thank you for contacting us. We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required /></div>
                    <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" placeholder="What is this about?" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required /></div>
                  <div className="space-y-2"><Label htmlFor="message">Message</Label><Textarea id="message" placeholder="Tell us how we can help..." value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="rounded-xl border-[#0F0F0F]/10 min-h-[150px]" required /></div>
                  <Button type="submit" className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12"><Send className="w-4 h-4 mr-2" />Send Message</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {contactInfo.map((info, index) => {
            const Icon = info.icon
            return (
              <Card key={index} className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0"><Icon className="w-6 h-6 text-[#2969FF]" /></div>
                    <div>
                      <h3 className="font-semibold text-[#0F0F0F] mb-2">{info.title}</h3>
                      {info.details.map((detail, detailIndex) => (<p key={detailIndex} className="text-sm text-[#0F0F0F]/60">{detail}</p>))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
