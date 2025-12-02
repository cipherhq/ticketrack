import { Shield } from 'lucide-react'

export function WebPrivacy() {
  const sections = [
    { title: '1. Information We Collect', content: [
      'Personal Information: When you create an account, we collect your name, email address, phone number, and payment information.',
      'Usage Data: We collect information about how you interact with our platform, including events viewed, searches made, and tickets purchased.',
      'Device Information: We collect information about the device you use to access our platform, including IP address, browser type, and operating system.',
    ]},
    { title: '2. How We Use Your Information', content: [
      'To process ticket purchases and send confirmations',
      'To communicate with you about events and updates',
      'To personalize your experience and recommend events',
      'To improve our platform and develop new features',
      'To detect and prevent fraud and ensure security',
    ]},
    { title: '3. Information Sharing', content: [
      'Event Organizers: We share your name and contact information with event organizers for events you attend.',
      'Payment Processors: We share payment information with our payment processors to complete transactions.',
      'Service Providers: We may share information with third-party service providers who assist in operating our platform.',
    ]},
    { title: '4. Data Security', content: [
      'We implement industry-standard security measures including encryption, secure servers, and regular security audits.',
      'All payment information is processed through PCI-compliant payment processors.',
      'We never store your full payment card details on our servers.',
    ]},
    { title: '5. Your Rights', content: [
      'Access: You can request a copy of your personal data at any time.',
      'Correction: You can update or correct your information through your account settings.',
      'Deletion: You can request deletion of your account and associated data.',
      'Opt-out: You can unsubscribe from marketing communications at any time.',
    ]},
    { title: '6. Cookies and Tracking', content: [
      'We use cookies and similar technologies to improve your experience and analyze platform usage.',
      'You can manage cookie preferences through your browser settings.',
      'Essential cookies are required for the platform to function properly.',
    ]},
    { title: '7. Data Retention', content: [
      'We retain your personal information for as long as your account is active or as needed to provide services.',
      'Transaction records are kept for legal and tax compliance purposes.',
      'You can request deletion of your data by contacting our support team.',
    ]},
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center"><Shield className="w-8 h-8 text-[#2969FF]" /></div>
        </div>
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Privacy Policy</h1>
        <p className="text-[#0F0F0F]/60">Last updated: December 1, 2024</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8 mb-8">
        <p className="text-[#0F0F0F]/70 leading-relaxed">
          At Ticketrack, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully to understand our practices regarding your personal data.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section, index) => (
          <div key={index} className="bg-white rounded-2xl border border-[#0F0F0F]/10 p-8">
            <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-4">{section.title}</h2>
            <ul className="space-y-3">
              {section.content.map((item, itemIndex) => (
                <li key={itemIndex} className="text-[#0F0F0F]/70 leading-relaxed flex items-start gap-3">
                  <span className="w-1.5 h-1.5 bg-[#2969FF] rounded-full mt-2 flex-shrink-0"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-[#F4F6FA] rounded-2xl p-8 mt-8 text-center">
        <h3 className="text-xl font-semibold text-[#0F0F0F] mb-4">Contact Us About Privacy</h3>
        <p className="text-[#0F0F0F]/70 mb-4">If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
        <p className="text-[#2969FF]">privacy@ticketrack.com</p>
      </div>
    </div>
  )
}
