import { Card } from '../components/ui/Card'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-primary-100">Last updated: December 2024</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8">
          <div className="prose prose-gray max-w-none">
            <h2>1. Introduction</h2>
            <p>
              Ticketrack ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our 
              event ticketing platform.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Personal Information</h3>
            <p>We collect information you provide directly to us, including:</p>
            <ul>
              <li>Name, email address, and phone number</li>
              <li>Payment information (processed securely through Paystack)</li>
              <li>Profile information and preferences</li>
              <li>Communications with us</li>
            </ul>

            <h3>Automatically Collected Information</h3>
            <p>When you use our platform, we automatically collect:</p>
            <ul>
              <li>Device information and IP address</li>
              <li>Browser type and settings</li>
              <li>Usage data and analytics</li>
              <li>Location information (with your consent)</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Process ticket purchases and deliver tickets</li>
              <li>Communicate with you about events and orders</li>
              <li>Improve our platform and services</li>
              <li>Prevent fraud and ensure security</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>4. Information Sharing</h2>
            <p>We may share your information with:</p>
            <ul>
              <li>Event organizers (for events you purchase tickets to)</li>
              <li>Payment processors (Paystack)</li>
              <li>Service providers who assist our operations</li>
              <li>Law enforcement when required by law</li>
            </ul>

            <h2>5. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption, secure servers, 
              and regular security audits. Payment information is processed through PCI-DSS compliant 
              payment processors.
            </p>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Opt out of marketing communications</li>
              <li>Export your data</li>
            </ul>

            <h2>7. Cookies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage, 
              and assist in our marketing efforts. You can control cookies through your browser settings.
            </p>

            <h2>8. Children's Privacy</h2>
            <p>
              Our platform is not intended for children under 13. We do not knowingly collect 
              information from children under 13.
            </p>

            <h2>9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place for such transfers.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any 
              significant changes by email or through our platform.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <ul>
              <li>Email: privacy@ticketrack.com</li>
              <li>Address: Lagos, Nigeria</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
