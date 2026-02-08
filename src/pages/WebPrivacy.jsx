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
      'To send transactional SMS messages (ticket confirmations, event reminders, check-in codes)',
      'To personalize your experience and recommend events',
      'To improve our platform and develop new features',
      'To detect and prevent fraud and ensure security',
    ]},
    { title: '3. Information Sharing', content: [
      'Event Organizers: We share your name and contact information with event organizers for events you attend.',
      'Payment Processors: We share payment information with our payment processors (Paystack, Stripe, PayPal) to complete transactions.',
      'SMS Service Providers: We share your phone number with our SMS providers (Twilio for US/UK/EU, Termii for Nigeria, Ghana, Kenya, and other supported countries) solely to deliver transactional messages.',
      'Service Providers: We may share information with third-party service providers who assist in operating our platform.',
    ]},
    { title: '4. SMS/Text Messaging Policy', content: [
      'By providing your phone number and opting in, you consent to receive transactional SMS messages from Ticketrack.',
      'Message types include: ticket confirmations, event reminders, check-in codes, order updates, and account security alerts.',
      'Message frequency varies based on your activity (typically 1-5 messages per event purchase).',
      'Message and data rates may apply depending on your mobile carrier and plan.',
      'SMS messages are sent via Twilio (US, UK, EU customers) and Termii (Nigeria, Ghana, Kenya, and other supported countries).',
      'We do not send promotional or marketing messages via SMS without separate explicit consent.',
      'Your phone number is never sold, rented, or shared for third-party marketing purposes.',
      'To opt-out of SMS messages, reply STOP to any message or update your notification preferences in account settings.',
      'For help with SMS, reply HELP to any message or contact support@ticketrack.com.',
    ]},
    { title: '5. Data Security', content: [
      'We implement industry-standard security measures including encryption, secure servers, and regular security audits.',
      'All payment information is processed through PCI-compliant payment processors.',
      'We never store your full payment card details on our servers.',
      'Phone numbers are stored securely and transmitted via encrypted connections to SMS providers.',
    ]},
    { title: '6. Your Rights (GDPR/UK GDPR)', content: [
      'Right of Access: You can request a copy of your personal data at any time via your Profile Settings.',
      'Right to Rectification: You can update or correct your information through your account settings.',
      'Right to Erasure ("Right to be Forgotten"): You can delete your account and all associated data via Profile → Settings → Delete Account.',
      'Right to Data Portability: You can export all your data in JSON format via Profile → Settings → Export My Data.',
      'Right to Object: You can opt-out of marketing communications at any time via your account settings or email unsubscribe links.',
      'Right to Restrict Processing: You can request we limit how we use your data by contacting support@ticketrack.com.',
      'Right to Withdraw Consent: Where we rely on consent, you can withdraw it at any time without affecting prior processing.',
      'SMS Opt-out: Reply STOP to any SMS message or manage preferences in your account settings.',
      'Automated Decision Making: We do not use automated decision-making or profiling that significantly affects you.',
    ]},
    { title: '6a. Legal Basis for Processing (GDPR Article 6)', content: [
      'Contract Performance: Processing your data to provide ticketing services, process payments, and deliver tickets you\'ve purchased.',
      'Legitimate Interests: Improving our services, fraud prevention, security, analytics, and customer support.',
      'Consent: Marketing communications and optional features require your explicit opt-in consent.',
      'Legal Obligations: Tax compliance, regulatory requirements, and responding to lawful requests from authorities.',
    ]},
    { title: '6b. UK & EU Specific Rights', content: [
      'For UK users: Your rights are protected under the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.',
      'For EU users: Your rights are protected under the EU General Data Protection Regulation (GDPR).',
      'Data Controller: Ticketrack Ltd is the data controller for your personal information.',
      'Supervisory Authority: You have the right to lodge a complaint with your local data protection authority (e.g., ICO in the UK).',
      'Contact for Data Protection: privacy@ticketrack.com or support@ticketrack.com',
    ]},
    { title: '7. Cookies and Tracking', content: [
      'We use cookies and similar technologies to improve your experience and analyze platform usage.',
      'You can manage cookie preferences through your browser settings.',
      'Essential cookies are required for the platform to function properly.',
    ]},
    { title: '8. Data Retention', content: [
      'We retain your personal information for as long as your account is active or as needed to provide services.',
      'Transaction records are kept for legal and tax compliance purposes.',
      'SMS delivery records are retained for 90 days for troubleshooting and compliance.',
      'You can request deletion of your data by contacting our support team.',
    ]},
    { title: '9. International Data Transfers', content: [
      'Your data may be processed in different countries depending on your location and the services used.',
      'For users in Nigeria, Ghana, Kenya, and other supported countries: Data is processed through Termii (Nigeria-based) and Paystack for local compliance.',
      'For US/UK/EU users: Data is processed through Twilio (US-based) and Stripe with appropriate data protection measures.',
      'We ensure all data transfers comply with applicable data protection laws including GDPR and NDPR.',
    ]},
    { title: '10. Changes to This Policy', content: [
      'We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements.',
      'We will notify you of significant changes via email or platform notification.',
      'Continued use of the platform after changes constitutes acceptance of the updated policy.',
    ]},
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center"><Shield className="w-8 h-8 text-[#2969FF]" /></div>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: January 20, 2026</p>
      </div>

      <div className="bg-card rounded-2xl border border-border/10 p-8 mb-8">
        <p className="text-foreground/70 leading-relaxed">
          At Ticketrack, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully to understand our practices regarding your personal data.
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section, index) => (
          <div key={index} className="bg-card rounded-2xl border border-border/10 p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">{section.title}</h2>
            <ul className="space-y-3">
              {section.content.map((item, itemIndex) => (
                <li key={itemIndex} className="text-foreground/70 leading-relaxed flex items-start gap-3">
                  <span className="w-1.5 h-1.5 bg-[#2969FF] rounded-full mt-2 flex-shrink-0"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* SMS Consent Summary Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 mt-8">
        <h3 className="text-xl font-semibold text-foreground mb-4">📱 SMS Messaging Summary</h3>
        <div className="text-foreground/70 space-y-2">
          <p><strong>What:</strong> Transactional messages only (ticket confirmations, reminders, check-in codes)</p>
          <p><strong>Frequency:</strong> 1-5 messages per event purchase</p>
          <p><strong>Cost:</strong> Message and data rates may apply</p>
          <p><strong>Opt-out:</strong> Reply STOP to any message</p>
          <p><strong>Help:</strong> Reply HELP or email support@ticketrack.com</p>
          <p><strong>Providers:</strong> Twilio (US/UK/EU) • Termii (Nigeria, Ghana, Kenya & more)</p>
        </div>
      </div>

      <div className="bg-muted rounded-2xl p-8 mt-8 text-center">
        <h3 className="text-xl font-semibold text-foreground mb-4">Contact Us About Privacy</h3>
        <p className="text-foreground/70 mb-4">If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
        <p className="text-[#2969FF]">privacy@ticketrack.com</p>
      </div>
    </div>
  )
}
