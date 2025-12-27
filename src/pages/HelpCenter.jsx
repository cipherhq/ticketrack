import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, ChevronDown, ChevronUp, Ticket, Users, Megaphone, Settings,
  ShoppingCart, CreditCard, RotateCcw, QrCode, Calendar, BarChart3,
  FileText, Download, CheckCircle, UserPlus, Link as LinkIcon, Wallet,
  HelpCircle, Mail, Shield, Bell, Eye, Plus, Edit, Trash2, Clock,
  Image as ImageIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Help content organized by category
const helpContent = {
  attendees: {
    title: 'Attendees',
    icon: Ticket,
    description: 'Everything you need to know about finding events, buying tickets, and managing your bookings.',
    color: 'bg-blue-500',
    articles: [
      {
        id: 'browse-events',
        title: 'How to Browse and Find Events',
        icon: Search,
        steps: [
          'Go to the homepage or click "Browse Events" in the navigation menu.',
          'Use the search bar to search by event name, location, or category.',
          'Filter events by date, price range, or category using the filter options.',
          'Click on any event card to view full details.'
        ],
        screenshot: '/help/browse-events.png',
        tips: ['Use specific keywords for better search results', 'Check the "Free Events" filter if you\'re looking for free activities']
      },
      {
        id: 'buy-tickets',
        title: 'How to Purchase Tickets',
        icon: ShoppingCart,
        steps: [
          'Navigate to the event page you want to attend.',
          'Select the ticket type and quantity you want.',
          'Click "Buy Tickets" or "Add to Cart".',
          'Fill in your contact information (name, email, phone).',
          'Complete any custom questions the organizer has set up.',
          'Choose your payment method (Card, Bank Transfer, or USSD).',
          'Complete the payment to receive your tickets via email.'
        ],
        screenshot: '/help/buy-tickets.png',
        tips: ['Make sure your email is correct - tickets will be sent there', 'Save your order confirmation for reference']
      },
      {
        id: 'view-tickets',
        title: 'How to View My Tickets',
        icon: Ticket,
        steps: [
          'Log into your Ticketrack account.',
          'Click on "My Tickets" in the navigation menu.',
          'View all your upcoming and past event tickets.',
          'Click on any ticket to see details and QR code.',
          'You can download your ticket or add it to your calendar.'
        ],
        screenshot: '/help/my-tickets.png',
        tips: ['Keep your QR code ready for check-in at the event', 'Screenshots of your QR code work for check-in too']
      },
      {
        id: 'request-refund',
        title: 'How to Request a Refund',
        icon: RotateCcw,
        steps: [
          'Go to "My Tickets" and find the ticket you want to refund.',
          'Click the "Request Refund" button (only available for eligible tickets).',
          'Review the refund amount (a processing fee may apply).',
          'Enter a reason for your refund request.',
          'Submit your request - the organizer will review it.',
          'You\'ll receive an email notification once approved or rejected.'
        ],
        screenshot: '/help/request-refund.png',
        tips: ['Refund requests must be made before the deadline (usually 48 hours before the event)', 'Keep your reason clear and honest for faster processing'],
        important: 'Not all events allow refunds. Check the event\'s refund policy before purchasing.'
      },
      {
        id: 'escalate-refund',
        title: 'How to Escalate a Refund Request',
        icon: Shield,
        steps: [
          'If your refund was rejected and you believe it should be approved, you can escalate.',
          'Go to "My Tickets" and find the rejected refund.',
          'Click "Escalate to Admin" button.',
          'Provide a detailed reason why you think the refund should be reconsidered.',
          'Our admin team will review your case and make a final decision.',
          'You\'ll be notified via email of the outcome.'
        ],
        screenshot: '/help/escalate-refund.png',
        tips: ['Provide documentation if available (e.g., emergency proof)', 'Escalations are reviewed within 3-5 business days']
      },
      {
        id: 'check-refund-status',
        title: 'How to Check Refund Status',
        icon: Eye,
        steps: [
          'Go to "My Tickets" in your account.',
          'Find the ticket with a pending refund.',
          'Look for the refund status badge (Pending, Approved, Rejected, or Processed).',
          'Click on the ticket to see detailed refund information and notes from the organizer.'
        ],
        screenshot: '/help/refund-status.png',
        tips: ['Pending means the organizer is reviewing', 'Approved means money is being processed', 'Processed means the refund is complete']
      }
    ]
  },
  organizers: {
    title: 'Organizers',
    icon: Users,
    description: 'Learn how to create events, manage attendees, handle refunds, and grow your audience.',
    color: 'bg-green-500',
    articles: [
      {
        id: 'create-event',
        title: 'How to Create an Event',
        icon: Plus,
        steps: [
          'Log in and go to your Organizer Dashboard.',
          'Click "+ Create Event" button.',
          'Fill in Basic Info: title, description, category, and event image.',
          'Set Date & Time: start date, end date, and timezone.',
          'Add Location: venue name, address, or mark as virtual event.',
          'Configure Tickets: add ticket types with names, prices, and quantities.',
          'Set Visibility: public, unlisted, password-protected, or invite-only.',
          'Review and click "Publish Event" to go live!'
        ],
        screenshot: '/help/create-event.png',
        tips: ['Use a high-quality event image (1200x630px recommended)', 'Write a compelling description to attract attendees']
      },
      {
        id: 'custom-checkout-forms',
        title: 'How to Add Custom Checkout Questions',
        icon: FileText,
        steps: [
          'When creating/editing an event, go to the "Ticketing" tab.',
          'Scroll down to "Custom Checkout Questions" section.',
          'Click "Add Question" to create a new field.',
          'Choose field type: Text (short answer) or Dropdown (multiple choice).',
          'Enter the question label (e.g., "T-Shirt Size").',
          'For dropdowns, add the options (e.g., Small, Medium, Large).',
          'Toggle "Required" if attendees must answer.',
          'Drag to reorder questions as needed.',
          'Save your event - questions will appear at checkout!'
        ],
        screenshot: '/help/custom-forms.png',
        tips: ['Keep questions minimal to avoid checkout abandonment', 'Use dropdowns when you have specific options'],
        example: 'Common custom questions: T-Shirt Size, Meal Preference, Dietary Restrictions, Emergency Contact'
      },
      {
        id: 'view-custom-responses',
        title: 'How to View Custom Form Responses',
        icon: Eye,
        steps: [
          'Go to Organizer Dashboard → Attendees.',
          'Find attendees who purchased tickets for events with custom questions.',
          'Look for the blue Eye icon (👁️) in the Actions column.',
          'Click the Eye icon to expand and see all their responses.',
          'Responses show the question label and their answer.'
        ],
        screenshot: '/help/view-responses.png',
        tips: ['Not all attendees will have the eye icon - only those who answered custom questions', 'Use the event filter to focus on specific events']
      },
      {
        id: 'export-attendees',
        title: 'How to Export Attendees to CSV',
        icon: Download,
        steps: [
          'Go to Organizer Dashboard → Attendees.',
          'Optionally filter by specific event using the dropdown.',
          'Click the "Export CSV" button.',
          'The download will include: Name, Email, Phone, Event, Ticket Type, and any Custom Form responses.',
          'Open the CSV in Excel, Google Sheets, or any spreadsheet app.'
        ],
        screenshot: '/help/export-csv.png',
        tips: ['Filter by event first to get a focused export', 'Custom form columns only appear if attendees answered questions']
      },
      {
        id: 'manage-refunds',
        title: 'How to Approve or Reject Refund Requests',
        icon: RotateCcw,
        steps: [
          'Go to Organizer Dashboard → Refunds.',
          'View pending refund requests from your attendees.',
          'Click on a request to see details (ticket info, reason, amount).',
          'Choose to "Approve" or "Reject" the request.',
          'Add a note explaining your decision (optional but recommended).',
          'Submit - the attendee will be notified via email.',
          'Approved refunds are processed by admin.'
        ],
        screenshot: '/help/organizer-refunds.png',
        tips: ['Respond quickly to maintain good attendee relationships', 'Clear notes help if the refund is escalated'],
        important: 'Approved refunds will be deducted from your payout. Reject only with valid reason.'
      },
      {
        id: 'check-in-attendees',
        title: 'How to Check-In Attendees',
        icon: QrCode,
        steps: [
          'Go to Organizer Dashboard → Check-In.',
          'Select the event from the dropdown.',
          'Use your phone/tablet camera to scan attendee QR codes.',
          'Or manually search by name/email/ticket code.',
          'Click "Check In" to mark attendance.',
          'Green checkmark confirms successful check-in.'
        ],
        screenshot: '/help/check-in.png',
        tips: ['Test the scanner before the event', 'Have a backup plan (manual search) in case of scanning issues']
      },
      {
        id: 'view-analytics',
        title: 'How to View Event Analytics',
        icon: BarChart3,
        steps: [
          'Go to Organizer Dashboard → Analytics.',
          'Select the event you want to analyze.',
          'View key metrics: total sales, tickets sold, revenue, check-ins.',
          'See sales trends over time in the chart.',
          'Review ticket type breakdown and referral sources.'
        ],
        screenshot: '/help/analytics.png',
        tips: ['Check analytics regularly to understand your audience', 'Use insights to improve future events']
      }
    ]
  },
  promoters: {
    title: 'Promoters',
    icon: Megaphone,
    description: 'Earn commissions by promoting events. Learn how to get started and track your earnings.',
    color: 'bg-purple-500',
    articles: [
      {
        id: 'become-promoter',
        title: 'How to Become a Promoter',
        icon: UserPlus,
        steps: [
          'Log into your Ticketrack account.',
          'Navigate to the Promoter section.',
          'Click "Become a Promoter" or "Apply Now".',
          'Fill in your details: name, phone, preferred payment method.',
          'Submit your application.',
          'Once approved, you\'ll have access to the Promoter Dashboard.'
        ],
        screenshot: '/help/become-promoter.png',
        tips: ['Make sure your contact info is correct for payouts', 'Approval usually happens within 24 hours']
      },
      {
        id: 'get-promo-link',
        title: 'How to Get Your Promo Link',
        icon: LinkIcon,
        steps: [
          'Go to your Promoter Dashboard.',
          'Browse available events you can promote.',
          'Click "Get Link" on any event.',
          'Copy your unique promotional link.',
          'Share on social media, WhatsApp, email, etc.',
          'Anyone who buys through your link earns you commission!'
        ],
        screenshot: '/help/promo-link.png',
        tips: ['Your link is unique - don\'t share someone else\'s link', 'Track which platforms work best for you']
      },
      {
        id: 'track-referrals',
        title: 'How to Track Your Referrals',
        icon: Eye,
        steps: [
          'Go to your Promoter Dashboard.',
          'View "My Referrals" section.',
          'See all purchases made through your links.',
          'Check status: Pending (unpaid), Confirmed, or Paid.',
          'Filter by event or date range.'
        ],
        screenshot: '/help/track-referrals.png',
        tips: ['Referrals may take a few minutes to appear', 'Pending referrals become confirmed after event ends']
      },
      {
        id: 'view-commissions',
        title: 'How to View Your Commissions',
        icon: Wallet,
        steps: [
          'Go to your Promoter Dashboard.',
          'View the Earnings Summary at the top.',
          'See breakdown: Total Earned, Pending, Available for Payout.',
          'Click on individual referrals to see commission details.',
          'Commission rate varies by event (usually 5-15%).'
        ],
        screenshot: '/help/commissions.png',
        tips: ['Commissions are calculated after deducting refunds', 'Different events may have different commission rates']
      },
      {
        id: 'request-payout',
        title: 'How to Request a Payout',
        icon: CreditCard,
        steps: [
          'Go to Promoter Dashboard → Payouts.',
          'Ensure you have "Available" balance (not just pending).',
          'Click "Request Payout".',
          'Enter the amount you want to withdraw.',
          'Confirm your bank details are correct.',
          'Submit request - payouts are processed weekly.',
          'You\'ll receive a confirmation email when paid.'
        ],
        screenshot: '/help/request-payout.png',
        tips: ['Minimum payout amount may apply', 'Make sure your bank details are up to date'],
        important: 'Payouts are processed every Monday. Requests made after Monday will be included in the next cycle.'
      }
    ]
  },
  general: {
    title: 'General',
    icon: Settings,
    description: 'Account settings, security, notifications, and getting help.',
    color: 'bg-gray-500',
    articles: [
      {
        id: 'account-settings',
        title: 'How to Update Account Settings',
        icon: Settings,
        steps: [
          'Click on your profile icon in the top navigation.',
          'Select "Settings" or "Account Settings".',
          'Update your profile: name, email, phone number.',
          'Change your password if needed.',
          'Save changes.'
        ],
        screenshot: '/help/account-settings.png',
        tips: ['Use a strong password with numbers and symbols', 'Keep your email up to date for important notifications']
      },
      {
        id: 'notifications',
        title: 'How to Manage Notifications',
        icon: Bell,
        steps: [
          'Go to Account Settings → Notifications.',
          'Toggle which notifications you want to receive.',
          'Options include: Email alerts, SMS reminders, Marketing updates.',
          'Save your preferences.'
        ],
        screenshot: '/help/notifications.png',
        tips: ['Keep event reminders on so you don\'t miss your events', 'You can unsubscribe from marketing but still get important alerts']
      },
      {
        id: 'contact-support',
        title: 'How to Contact Support',
        icon: Mail,
        steps: [
          'Click "Help" or "Support" in the navigation.',
          'Browse FAQs to see if your question is answered.',
          'If not, click "Contact Us" or use the chat widget.',
          'Describe your issue in detail.',
          'Include order number or event name if relevant.',
          'Our team typically responds within 24 hours.'
        ],
        screenshot: '/help/contact-support.png',
        tips: ['Include screenshots if you\'re experiencing a bug', 'The more detail you provide, the faster we can help']
      },
      {
        id: 'security',
        title: 'Security & Privacy Tips',
        icon: Shield,
        steps: [
          'Use a unique password for your Ticketrack account.',
          'Never share your login credentials with anyone.',
          'Log out from shared or public computers.',
          'Report suspicious activity to support immediately.',
          'Keep your email secure - it\'s used for password recovery.'
        ],
        screenshot: '/help/security.png',
        tips: ['Enable two-factor authentication if available', 'Review your login history periodically']
      }
    ]
  }
};

// Accordion Component
function Accordion({ article, isOpen, onToggle }) {
  return (
    <div className="border border-[#0F0F0F]/10 rounded-xl overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#F4F6FA]/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
            <article.icon className="w-5 h-5 text-[#2969FF]" />
          </div>
          <span className="font-medium text-[#0F0F0F]">{article.title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[#0F0F0F]/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#0F0F0F]/60" />
        )}
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 bg-white">
          {/* Steps */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[#0F0F0F]/60 uppercase tracking-wide mb-3">Steps</h4>
            <ol className="space-y-2">
              {article.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2969FF] text-white text-sm flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-[#0F0F0F]/80 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Screenshot Placeholder */}
          {article.screenshot && (
            <div className="mb-4 p-6 bg-[#F4F6FA] rounded-xl border-2 border-dashed border-[#0F0F0F]/20 text-center">
              <ImageIcon className="w-8 h-8 text-[#0F0F0F]/30 mx-auto mb-2" />
              <p className="text-sm text-[#0F0F0F]/50">Screenshot: {article.screenshot}</p>
              <p className="text-xs text-[#0F0F0F]/40 mt-1">Image will be added here</p>
            </div>
          )}

          {/* Tips */}
          {article.tips && article.tips.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> Tips
              </h4>
              <ul className="space-y-1">
                {article.tips.map((tip, idx) => (
                  <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Example */}
          {article.example && (
            <div className="mb-4 p-4 bg-green-50 rounded-xl">
              <h4 className="text-sm font-semibold text-green-700 mb-1">Example</h4>
              <p className="text-sm text-green-700">{article.example}</p>
            </div>
          )}

          {/* Important Note */}
          {article.important && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h4 className="text-sm font-semibold text-amber-700 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Important
              </h4>
              <p className="text-sm text-amber-700">{article.important}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HelpCenter() {
  const [activeTab, setActiveTab] = useState('attendees');
  const [searchTerm, setSearchTerm] = useState('');
  const [openArticles, setOpenArticles] = useState({});

  // Filter articles based on search
  const filteredContent = useMemo(() => {
    if (!searchTerm.trim()) return null;
    
    const results = [];
    const term = searchTerm.toLowerCase();
    
    Object.entries(helpContent).forEach(([category, data]) => {
      data.articles.forEach(article => {
        const matchTitle = article.title.toLowerCase().includes(term);
        const matchSteps = article.steps.some(s => s.toLowerCase().includes(term));
        const matchTips = article.tips?.some(t => t.toLowerCase().includes(term));
        
        if (matchTitle || matchSteps || matchTips) {
          results.push({ ...article, category, categoryTitle: data.title, categoryColor: data.color });
        }
      });
    });
    
    return results;
  }, [searchTerm]);

  const toggleArticle = (articleId) => {
    setOpenArticles(prev => ({ ...prev, [articleId]: !prev[articleId] }));
  };

  const currentCategory = helpContent[activeTab];

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1a4fd6] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Help Center</h1>
          <p className="text-white/80 text-lg mb-8">
            Find answers, guides, and tips on how to use Ticketrack
          </p>
          
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input
              type="text"
              placeholder="Search for help articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 h-14 rounded-2xl bg-white text-[#0F0F0F] border-0 shadow-lg text-lg"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Results */}
        {filteredContent && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#0F0F0F]">
                Search Results ({filteredContent.length})
              </h2>
              <Button 
                variant="ghost" 
                onClick={() => setSearchTerm('')}
                className="text-[#2969FF]"
              >
                Clear Search
              </Button>
            </div>
            
            {filteredContent.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                  <p className="text-[#0F0F0F]/60">No results found for "{searchTerm}"</p>
                  <p className="text-sm text-[#0F0F0F]/40 mt-2">Try different keywords or browse categories below</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {filteredContent.map(article => (
                  <div key={article.id} className="mb-2">
                    <Badge className={`${article.categoryColor} text-white mb-2`}>
                      {article.categoryTitle}
                    </Badge>
                    <Accordion
                      article={article}
                      isOpen={openArticles[article.id]}
                      onToggle={() => toggleArticle(article.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category Tabs */}
        {!filteredContent && (
          <>
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              {Object.entries(helpContent).map(([key, category]) => {
                const Icon = category.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
                      activeTab === key
                        ? 'bg-[#2969FF] text-white shadow-lg shadow-[#2969FF]/25'
                        : 'bg-white text-[#0F0F0F]/70 hover:bg-[#0F0F0F]/5 border border-[#0F0F0F]/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {category.title}
                  </button>
                );
              })}
            </div>

            {/* Category Header */}
            <Card className="border-[#0F0F0F]/10 rounded-2xl mb-6 overflow-hidden">
              <div className={`${currentCategory.color} p-6`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                    <currentCategory.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{currentCategory.title}</h2>
                    <p className="text-white/80">{currentCategory.description}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Articles */}
            <div>
              {currentCategory.articles.map(article => (
                <Accordion
                  key={article.id}
                  article={article}
                  isOpen={openArticles[article.id]}
                  onToggle={() => toggleArticle(article.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Still Need Help */}
        <Card className="border-[#0F0F0F]/10 rounded-2xl mt-8 overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[#2969FF]" />
            </div>
            <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Still Need Help?</h3>
            <p className="text-[#0F0F0F]/60 mb-6">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                className="bg-[#2969FF] hover:bg-[#1a4fd6] text-white rounded-xl px-6"
                asChild
              >
                <a href="mailto:support@ticketrack.com">
                  <Mail className="w-4 h-4 mr-2" /> Email Support
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl px-6 border-[#0F0F0F]/20"
                asChild
              >
                <Link to="/contact">
                  <HelpCircle className="w-4 h-4 mr-2" /> Contact Us
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-[#0F0F0F]/40 mt-8">
          Last updated: December 2024 • Ticketrack Help Center
        </p>
      </div>
    </div>
  );
}
