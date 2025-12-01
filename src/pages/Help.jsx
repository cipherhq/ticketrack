import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Search, ChevronDown, ChevronUp, Ticket, CreditCard, Calendar, Shield, HelpCircle, MessageSquare } from 'lucide-react'

const faqs = [
  {
    category: 'Tickets',
    icon: Ticket,
    questions: [
      {
        q: 'How do I buy tickets?',
        a: 'Simply browse events, select the tickets you want, add them to your cart, and complete the checkout process. You\'ll receive your tickets via email immediately after payment.'
      },
      {
        q: 'Can I get a refund for my tickets?',
        a: 'Refund policies vary by event. Check the event page for specific refund information. Generally, refunds must be requested at least 48 hours before the event.'
      },
      {
        q: 'How do I access my tickets?',
        a: 'After purchase, you can find your tickets in the "My Tickets" section of your account. Each ticket has a unique QR code for entry.'
      },
      {
        q: 'Can I transfer my ticket to someone else?',
        a: 'Yes, you can transfer tickets to another person through your ticket management page. The new holder will receive the ticket via email.'
      }
    ]
  },
  {
    category: 'Payments',
    icon: CreditCard,
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept card payments (Visa, Mastercard), bank transfers, and USSD payments through Paystack. Available payment methods may vary by country.'
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes, we use Paystack for payment processing, which is PCI-DSS compliant. We never store your card details on our servers.'
      },
      {
        q: 'What currency will I be charged in?',
        a: 'You\'ll be charged in the local currency of the event\'s country. We support NGN, GHS, KES, RWF, ZAR, and XAF.'
      },
      {
        q: 'What are the fees?',
        a: 'Ticketrack charges a 10% platform fee on all ticket sales. This fee is typically included in the ticket price shown.'
      }
    ]
  },
  {
    category: 'Events',
    icon: Calendar,
    questions: [
      {
        q: 'How do I find events near me?',
        a: 'Use our search feature or browse by category and country. You can filter events by date, location, and type.'
      },
      {
        q: 'What if an event is cancelled?',
        a: 'If an event is cancelled, you\'ll receive a full refund automatically. We\'ll notify you via email about the cancellation.'
      },
      {
        q: 'Can I sell tickets for my own event?',
        a: 'Yes! Sign up as an organizer to create and manage your own events. You\'ll have access to our organizer dashboard with analytics, attendee management, and payout features.'
      }
    ]
  },
  {
    category: 'Security',
    icon: Shield,
    questions: [
      {
        q: 'Is Ticketrack safe to use?',
        a: 'Absolutely. We use bank-level encryption, secure payment processing, and robust authentication to protect your data.'
      },
      {
        q: 'How do I protect my account?',
        a: 'Use a strong password, enable two-factor authentication, and never share your login credentials with anyone.'
      },
      {
        q: 'What if I suspect fraudulent activity?',
        a: 'Contact us immediately at support@ticketrack.com. We take security seriously and will investigate all reports.'
      }
    ]
  }
]

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState({})

  const toggleItem = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Help Center</h1>
          <p className="text-primary-100 text-lg mb-8">Find answers to common questions</p>
          
          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-4 text-gray-900"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {faqs.map((category, i) => {
            const Icon = category.icon
            return (
              <a
                key={i}
                href={`#${category.category.toLowerCase()}`}
                className="bg-white rounded-xl p-4 text-center hover:shadow-md transition border"
              >
                <Icon className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <p className="font-medium">{category.category}</p>
              </a>
            )
          })}
        </div>

        {/* FAQs */}
        <div className="space-y-8">
          {filteredFaqs.map((category, categoryIndex) => {
            const Icon = category.icon
            return (
              <div key={categoryIndex} id={category.category.toLowerCase()}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <Icon className="w-6 h-6 text-primary-500" />
                  {category.category}
                </h2>
                <Card className="divide-y">
                  {category.questions.map((item, questionIndex) => {
                    const key = `${categoryIndex}-${questionIndex}`
                    const isOpen = openItems[key]
                    return (
                      <div key={questionIndex}>
                        <button
                          onClick={() => toggleItem(categoryIndex, questionIndex)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
                        >
                          <span className="font-medium pr-4">{item.q}</span>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-gray-600 animate-fade-in">
                            {item.a}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              </div>
            )
          })}
        </div>

        {/* Still Need Help */}
        <Card className="mt-12 p-8 text-center bg-primary-50 border-primary-200">
          <HelpCircle className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Still Need Help?</h3>
          <p className="text-gray-600 mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <Link to="/contact">
            <Button>
              <MessageSquare className="w-5 h-5 mr-2" />
              Contact Support
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
