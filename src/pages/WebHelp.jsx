import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, HelpCircle, Ticket, CreditCard, Users, Shield, Settings, Book } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

const categories = [
  { icon: Ticket, title: 'Buying Tickets', description: 'Learn how to browse and purchase event tickets', color: 'bg-blue-500' },
  { icon: CreditCard, title: 'Payments & Refunds', description: 'Payment methods, refunds, and billing questions', color: 'bg-green-500' },
  { icon: Users, title: 'Account Management', description: 'Manage your profile, settings, and preferences', color: 'bg-purple-500' },
  { icon: Book, title: 'Event Organizers', description: 'Create and manage events, handle sales', color: 'bg-orange-500' },
  { icon: Shield, title: 'Safety & Security', description: 'Account security and fraud prevention', color: 'bg-red-500' },
  { icon: Settings, title: 'Technical Support', description: 'App issues, troubleshooting, and technical help', color: 'bg-gray-500' },
]

const faqs = [
  { category: 'General', questions: [
    { question: 'What is Ticketrack?', answer: "Ticketrack is the world's leading event ticketing platform that connects event organizers with attendees across the globe." },
    { question: 'How do I create an account?', answer: 'Click on "Sign Up" in the top right corner, enter your email, create a password, and verify your email address.' },
    { question: 'Is Ticketrack free to use?', answer: 'Creating an account and browsing events is completely free. We charge a small service fee when you purchase tickets.' },
  ]},
  { category: 'Buying Tickets', questions: [
    { question: 'How do I purchase tickets?', answer: 'Browse events, select an event, choose your ticket type and quantity, add to cart, and proceed to checkout.' },
    { question: 'What payment methods do you accept?', answer: 'We accept credit/debit cards, bank transfers, and USSD payments.' },
  ]},
  { category: 'Refunds', questions: [
    { question: 'How do I request a refund?', answer: 'Go to your tickets page, select the ticket, and click "Request Refund". Eligibility depends on the organizer\'s policy.' },
    { question: 'What happens if an event is cancelled?', answer: 'If an event is cancelled, all ticket holders will receive automatic refunds including service fees.' },
  ]},
]

export function WebHelp() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(q => q.question.toLowerCase().includes(searchQuery.toLowerCase()) || q.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  })).filter(category => category.questions.length > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center"><HelpCircle className="w-8 h-8 text-[#2969FF]" /></div>
        </div>
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Help Center</h1>
        <p className="text-xl text-[#0F0F0F]/60 max-w-2xl mx-auto mb-8">Find answers to your questions and learn how to get the most out of Ticketrack</p>

        <div className="max-w-2xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
          <Input placeholder="Search for help..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-14 rounded-2xl border-[#0F0F0F]/10 text-base" />
        </div>
      </div>

      {!searchQuery && (
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Browse by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => {
              const Icon = category.icon
              return (
                <Card key={index} className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF]/30 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center mb-4`}><Icon className="w-6 h-6 text-white" /></div>
                    <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">{category.title}</h3>
                    <p className="text-sm text-[#0F0F0F]/60">{category.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">{searchQuery ? 'Search Results' : 'Frequently Asked Questions'}</h2>
        {filteredFaqs.length === 0 ? (
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No results found for "{searchQuery}". Try different keywords.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filteredFaqs.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                {!searchQuery && <h3 className="text-xl font-semibold text-[#0F0F0F] mb-4">{category.category}</h3>}
                <Accordion type="single" collapsible className="space-y-4">
                  {category.questions.map((faq, faqIndex) => (
                    <AccordionItem key={faqIndex} value={`${categoryIndex}-${faqIndex}`} className="border border-[#0F0F0F]/10 rounded-2xl px-6 bg-white">
                      <AccordionTrigger className="text-[#0F0F0F] hover:no-underline py-6">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-[#0F0F0F]/70 pb-6">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card className="border-[#2969FF]/20 bg-[#2969FF]/5 rounded-2xl mt-16">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Still need help?</h2>
          <p className="text-[#0F0F0F]/70 mb-6">Can't find what you're looking for? Our support team is here to help.</p>
          <Button onClick={() => navigate('/contact')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12 px-8">Contact Support</Button>
        </CardContent>
      </Card>
    </div>
  )
}
