import { Card } from '../components/ui/Card'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-primary-100">Last updated: December 2024</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8">
          <div className="prose prose-gray max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Ticketrack's platform, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Ticketrack is an event ticketing platform that enables event organizers to sell tickets 
              and attendees to purchase tickets for events across Africa. We act as an intermediary 
              between event organizers and ticket purchasers.
            </p>

            <h2>3. User Accounts</h2>
            <ul>
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must be at least 18 years old to create an account</li>
              <li>One person may not maintain multiple accounts</li>
            </ul>

            <h2>4. Ticket Purchases</h2>
            <h3>For Attendees</h3>
            <ul>
              <li>All ticket sales are final unless the event is cancelled or the organizer's refund policy permits</li>
              <li>Tickets are non-transferable unless specifically allowed by the event</li>
              <li>You must present a valid ticket (QR code) for entry</li>
              <li>Ticketrack is not responsible for event cancellations or changes made by organizers</li>
            </ul>

            <h3>For Organizers</h3>
            <ul>
              <li>You must provide accurate event information</li>
              <li>You are responsible for delivering the promised event experience</li>
              <li>You must comply with all applicable laws and regulations</li>
              <li>You agree to our fee structure (10% platform fee)</li>
            </ul>

            <h2>5. Fees and Payments</h2>
            <ul>
              <li>Ticketrack charges a 10% platform fee on all ticket sales</li>
              <li>Payments are processed through secure third-party processors (Paystack)</li>
              <li>Organizers receive payouts within 3-5 business days after event completion</li>
              <li>All prices include applicable taxes unless otherwise stated</li>
            </ul>

            <h2>6. Refunds and Cancellations</h2>
            <ul>
              <li>Refund policies are set by individual event organizers</li>
              <li>If an event is cancelled, ticket holders will receive a full refund</li>
              <li>Refund requests must be submitted through your account</li>
              <li>Platform fees may be non-refundable in certain circumstances</li>
            </ul>

            <h2>7. Prohibited Conduct</h2>
            <p>You may not:</p>
            <ul>
              <li>Use the platform for any illegal purpose</li>
              <li>Sell counterfeit or fraudulent tickets</li>
              <li>Attempt to circumvent our security measures</li>
              <li>Resell tickets at inflated prices (scalping)</li>
              <li>Create fake events or misleading listings</li>
              <li>Harass other users or staff</li>
            </ul>

            <h2>8. Intellectual Property</h2>
            <p>
              All content on Ticketrack, including logos, text, graphics, and software, is owned by 
              Ticketrack or its licensors and is protected by intellectual property laws.
            </p>

            <h2>9. Limitation of Liability</h2>
            <p>
              Ticketrack is not liable for any indirect, incidental, special, consequential, or 
              punitive damages arising from your use of the platform. Our total liability is 
              limited to the amount you paid for tickets.
            </p>

            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Ticketrack, its officers, directors, employees, 
              and agents from any claims, damages, or expenses arising from your use of the platform 
              or violation of these terms.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We may modify these terms at any time. Continued use of the platform after changes 
              constitutes acceptance of the modified terms.
            </p>

            <h2>12. Governing Law</h2>
            <p>
              These terms are governed by the laws of Nigeria. Any disputes will be resolved in 
              the courts of Lagos, Nigeria.
            </p>

            <h2>13. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us at:
            </p>
            <ul>
              <li>Email: legal@ticketrack.com</li>
              <li>Address: Lagos, Nigeria</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
