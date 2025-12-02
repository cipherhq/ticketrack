import { FileText } from 'lucide-react'

export function WebTerms() {
  const sections = [
    { title: '1. Acceptance of Terms', content: 'By accessing or using the Ticketrack platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.' },
    { title: '2. User Accounts', content: 'You must create an account to purchase tickets or host events. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must be at least 18 years old to create an account.' },
    { title: '3. Ticket Purchases', content: 'When you purchase a ticket through Ticketrack, you enter into a direct agreement with the event organizer. Ticketrack acts as an intermediary facilitating the transaction. All ticket sales are final unless the event is cancelled or the organizer offers refunds.' },
    { title: '4. Refund Policy', content: 'Refund policies are set by individual event organizers. Ticketrack will process refunds according to the organizer\'s policy. If an event is cancelled, Ticketrack will facilitate full refunds including service fees within 14 business days.' },
    { title: '5. Event Organizer Responsibilities', content: 'Event organizers are responsible for accurate event information, delivering the promised event experience, handling attendee inquiries, and complying with all applicable laws and regulations.' },
    { title: '6. Prohibited Conduct', content: 'Users may not resell tickets at inflated prices (scalping), create fake events or misleading listings, use automated systems to purchase tickets, harass other users or organizers, or attempt to circumvent our security measures.' },
    { title: '7. Intellectual Property', content: 'All content on the Ticketrack platform, including logos, designs, and text, is protected by intellectual property rights. Users may not copy, modify, or distribute our content without permission.' },
    { title: '8. Limitation of Liability', content: 'Ticketrack is not liable for event quality, cancellations, or changes made by organizers. Our liability is limited to the amount of fees paid to Ticketrack for the specific transaction in question.' },
    { title: '9. Modifications to Terms', content: 'We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notification.' },
    { title: '10. Governing Law', content: 'These Terms of Service are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through arbitration in Lagos, Nigeria.' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center"><FileText className="w-8 h-8 text-[#2969FF]" /></div>
        </div>
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Terms of Service</h1>
        <p className="text-[#0F0F0F]/60">Last updated: December 1, 2024</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8 mb-8">
        <p className="text-[#0F0F0F]/70 leading-relaxed">
          Welcome to Ticketrack. These Terms of Service govern your use of our platform and services. By using Ticketrack, you agree to these terms in full. Please read them carefully before using our services.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8">
            <h2 className="text-xl font-semibold text-[#0F0F0F] mb-4">{section.title}</h2>
            <p className="text-[#0F0F0F]/70 leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#F4F6FA] rounded-2xl p-8 mt-8 text-center">
        <h3 className="text-xl font-semibold text-[#0F0F0F] mb-4">Questions About Our Terms?</h3>
        <p className="text-[#0F0F0F]/70 mb-4">If you have any questions about these Terms of Service, please contact our legal team:</p>
        <p className="text-[#2969FF]">legal@ticketrack.com</p>
      </div>
    </div>
  )
}
