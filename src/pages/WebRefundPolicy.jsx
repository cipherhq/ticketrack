import { RotateCcw, Clock, AlertCircle, CheckCircle, XCircle, HelpCircle, Mail } from 'lucide-react'

export function WebRefundPolicy() {
  const refundTypes = [
    {
      title: 'Event Cancelled',
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      description: 'Full refund including all fees',
      timeline: 'Processed within 5-10 business days',
      details: 'If an organizer cancels an event, all ticket holders receive a full refund automatically. This includes the ticket price and all service fees.'
    },
    {
      title: 'Organizer Approved',
      icon: CheckCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      description: 'Refund based on organizer\'s policy',
      timeline: 'Processed within 5-10 business days after approval',
      details: 'If you request a refund and the organizer approves it, you\'ll receive a refund according to their refund policy. Some organizers may deduct a processing fee.'
    },
    {
      title: 'Refund Request Denied',
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      description: 'No refund issued',
      timeline: 'N/A',
      details: 'Organizers may deny refund requests if they fall outside their refund policy window or don\'t meet their criteria. You may escalate to our admin team if you believe the denial was unfair.'
    }
  ]

  const faqItems = [
    {
      question: 'How do I request a refund?',
      answer: 'Go to "My Tickets" in your account, find the ticket you want to refund, and click "Request Refund". Enter your reason and submit. The organizer will review your request.'
    },
    {
      question: 'How long do refunds take?',
      answer: 'Once approved, refunds typically take 5-10 business days to appear in your account, depending on your payment method and bank.'
    },
    {
      question: 'Can I get a refund for any event?',
      answer: 'Refund eligibility depends on each organizer\'s refund policy. Check the event page for refund policy details before purchasing.'
    },
    {
      question: 'What if the organizer doesn\'t respond?',
      answer: 'Organizers have 7 days to respond to refund requests. If they don\'t respond, you can escalate to our admin team for review.'
    },
    {
      question: 'Are service fees refundable?',
      answer: 'For cancelled events, yes - all fees are refunded. For organizer-approved refunds, service fees may or may not be included based on their policy.'
    },
    {
      question: 'Can I transfer my ticket instead of getting a refund?',
      answer: 'Yes! If the organizer has enabled ticket transfers, you can transfer your ticket to someone else instead of requesting a refund. Go to "My Tickets" and click "Transfer".'
    }
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0F0F0F] to-[#2a2a2a] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <RotateCcw className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">Refund Policy</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Understanding how refunds work on Ticketrack
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">How Refunds Work</h2>
            <p className="text-[#0F0F0F]/70 mb-4">
              Ticketrack acts as a platform connecting event organizers with attendees. Refund policies are set by individual event organizers. When you purchase a ticket, you agree to the organizer's refund policy displayed on the event page.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                <strong>Important:</strong> Always check the refund policy on the event page before purchasing. Refund policies vary by event and organizer.
              </p>
            </div>
          </div>
        </section>

        {/* Refund Types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Refund Scenarios</h2>
          <div className="space-y-4">
            {refundTypes.map((type, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${type.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <type.icon className={`w-6 h-6 ${type.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#0F0F0F] mb-1">{type.title}</h3>
                    <p className="text-[#2969FF] font-medium text-sm mb-2">{type.description}</p>
                    <p className="text-[#0F0F0F]/60 mb-2">{type.details}</p>
                    <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/50">
                      <Clock className="w-4 h-4" />
                      {type.timeline}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Refund Timeline */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Refund Process Timeline</h2>
          <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">1</div>
                <div>
                  <h4 className="font-semibold text-[#0F0F0F]">Request Submitted</h4>
                  <p className="text-[#0F0F0F]/60 text-sm">You submit a refund request with your reason</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">2</div>
                <div>
                  <h4 className="font-semibold text-[#0F0F0F]">Organizer Review (up to 7 days)</h4>
                  <p className="text-[#0F0F0F]/60 text-sm">The organizer reviews your request based on their policy</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">3</div>
                <div>
                  <h4 className="font-semibold text-[#0F0F0F]">Decision & Processing</h4>
                  <p className="text-[#0F0F0F]/60 text-sm">If approved, refund is initiated immediately</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">✓</div>
                <div>
                  <h4 className="font-semibold text-[#0F0F0F]">Funds Returned (5-10 business days)</h4>
                  <p className="text-[#0F0F0F]/60 text-sm">Money appears in your original payment method</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-6">
                <div className="flex gap-3">
                  <HelpCircle className="w-5 h-5 text-[#2969FF] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-[#0F0F0F] mb-2">{item.question}</h3>
                    <p className="text-[#0F0F0F]/60">{item.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section>
          <div className="bg-gradient-to-br from-[#2969FF]/10 to-[#2969FF]/5 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Need Help with a Refund?</h2>
            <p className="text-[#0F0F0F]/70 mb-6">
              If you're having trouble with a refund or need to escalate an issue, our support team is here to help.
            </p>
            <a href="mailto:support@ticketrack.com" className="inline-flex items-center gap-2 bg-[#2969FF] text-white px-6 py-3 rounded-xl hover:bg-[#1e4fd6] transition-colors">
              <Mail className="w-5 h-5" />
              Contact Support
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

export default WebRefundPolicy
