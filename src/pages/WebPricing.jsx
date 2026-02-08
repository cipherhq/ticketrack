import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, X, MapPin, ChevronDown, Ticket, Users, 
  CreditCard, BarChart3, Shield, Zap, Clock, Mail,
  Smartphone, QrCode, RefreshCw, Calendar, Globe,
  Sparkles, ArrowRight, Star, MessageCircle, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { getPlatformStats } from '@/services/settings';

// Flag mapping - flags rarely change, so we keep them here
const FLAG_MAP = {
  NG: '🇳🇬',
  GH: '🇬🇭',
  ZA: '🇿🇦',
  KE: '🇰🇪',
  US: '🇺🇸',
  CA: '🇨🇦',
  GB: '🇬🇧',
};

// Feature comparison data (static - these are features, not fees)
const featureComparison = [
  { feature: 'Free events (no fees)', ticketrack: true, others: true },
  { feature: 'Unlimited paid events', ticketrack: true, others: true },
  { feature: 'Pass fees to attendees', ticketrack: true, others: true },
  { feature: 'Multi-day events', ticketrack: true, others: false },
  { feature: 'Waitlist management', ticketrack: true, others: false },
  { feature: 'Refund management system', ticketrack: true, others: false },
  { feature: 'AI-powered communications', ticketrack: true, others: false },
  { feature: 'Promoter tracking & commissions', ticketrack: true, others: false },
  { feature: 'Recurring events', ticketrack: true, others: true },
  { feature: 'Custom event URL', ticketrack: true, others: true },
  { feature: 'QR code check-in', ticketrack: true, others: true },
  { feature: 'Real-time analytics', ticketrack: true, others: true },
  { feature: 'Multi-currency support', ticketrack: true, others: false },
  { feature: 'Bank transfer payouts', ticketrack: true, others: true },
  { feature: 'Mobile money payments', ticketrack: true, others: true },
  { feature: 'Sponsor management', ticketrack: true, others: false },
];

// Feature cards data (static - marketing content)
const featureCards = [
  {
    icon: Ticket,
    title: 'Smart Ticketing',
    description: 'Create multiple ticket types with custom pricing, limits, and sale windows. Table seating and VIP packages supported.',
    color: 'bg-blue-500'
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track sales, revenue, and attendee demographics with beautiful dashboards. Export reports anytime.',
    color: 'bg-purple-500'
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Marketing',
    description: 'Generate event descriptions, email campaigns, and social posts with AI. Save hours on marketing.',
    color: 'bg-pink-500'
  },
  {
    icon: Users,
    title: 'Attendee Management',
    description: 'Manage waitlists, send updates, and handle refunds seamlessly. Your attendees will love the experience.',
    color: 'bg-green-500'
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'PCI-DSS compliant payment processing. Support for cards, bank transfers, and mobile money.',
    color: 'bg-orange-500'
  },
  {
    icon: QrCode,
    title: 'Seamless Check-in',
    description: 'Scan QR codes with our mobile app. Works offline too. Check in thousands of guests in minutes.',
    color: 'bg-cyan-500'
  }
];

export function WebPricing() {
  const [selectedCountry, setSelectedCountry] = useState('NG');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pricingData, setPricingData] = useState({});
  const [platformStats, setPlatformStats] = useState({
    eventsHosted: '100+',
    ticketsSold: '1K+',
    organizers: '50+',
    countries: '6'
  });
  
  // Fetch pricing data and platform stats from database on mount
  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    try {
      // Fetch countries with their fees
      const { data: countries, error: countriesError } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (countriesError) {
        console.error('Error loading countries:', countriesError);
        return;
      }

      // Fetch currencies for symbols
      const { data: currencies, error: currenciesError } = await supabase
        .from('currencies')
        .select('code, symbol, name');

      if (currenciesError) {
        console.error('Error loading currencies:', currenciesError);
        return;
      }

      // Create currency lookup map
      const currencyMap = {};
      currencies?.forEach(c => {
        currencyMap[c.code] = c;
      });

      // Transform data into pricing format
      // Shows only 2 fees: service_fee_percentage + service_fee_fixed
      const pricing = {};
      countries?.forEach(country => {
        const currency = currencyMap[country.default_currency] || {};
        
        // Get the two public-facing fees
        const percentage = parseFloat(country.service_fee_percentage || 0);
        const flatFee = parseFloat(country.service_fee_fixed_per_ticket || 0);
        
        pricing[country.code] = {
          country: country.name,
          flag: FLAG_MAP[country.code] || '🏳️',
          currency: currency.symbol || country.default_currency,
          currencyCode: country.default_currency,
          percentage: `${percentage}%`,
          percentageValue: percentage,
          flatFee: flatFee.toString(),
          flatFeeValue: flatFee,
          paymentProvider: country.payment_provider,
          cap: country.service_fee_cap ? parseFloat(country.service_fee_cap) : null,
          savings: 'Best Value'
        };
      });

      setPricingData(pricing);
      
      // Set default country to first available if NG not available
      if (!pricing['NG'] && Object.keys(pricing).length > 0) {
        setSelectedCountry(Object.keys(pricing)[0]);
      }
      
      // Fetch platform stats
      try {
        const stats = await getPlatformStats();
        setPlatformStats(stats);
      } catch (err) {
        console.warn('Failed to fetch platform stats');
      }
    } catch (error) {
      console.error('Error loading pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pricing = pricingData[selectedCountry] || {};

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // No pricing data available
  if (Object.keys(pricingData).length === 0) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Pricing information is currently unavailable.</p>
          <Link to="/" className="text-[#2969FF] hover:underline mt-4 inline-block">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2969FF] via-[#1e4fd4] to-[#0a2d7a] text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-card rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-card rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-card/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Simple, transparent pricing</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Sell tickets.
              <br />
              <span className="text-white/80">Keep more of what you earn.</span>
            </h1>
            
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              No monthly fees. No hidden charges. Just simple pricing that helps you grow your events worldwide.
            </p>

            {/* Country Selector */}
            <div className="relative inline-block mb-10">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 bg-card/10 backdrop-blur-sm hover:bg-card/20 transition-all rounded-2xl px-6 py-4 border border-white/20"
              >
                <MapPin className="w-5 h-5" />
                <span className="text-2xl">{pricing.flag}</span>
                <span className="font-semibold">{pricing.country}</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-2xl shadow-2xl overflow-hidden z-50">
                  {Object.entries(pricingData).map(([code, data]) => (
                    <button
                      key={code}
                      onClick={() => {
                        setSelectedCountry(code);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-background transition-colors text-foreground ${
                        selectedCountry === code ? 'bg-[#2969FF]/5' : ''
                      }`}
                    >
                      <span className="text-2xl">{data.flag}</span>
                      <span className="font-medium">{data.country}</span>
                      {selectedCountry === code && (
                        <Check className="w-5 h-5 text-[#2969FF] ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing Display */}
            <div className="bg-card rounded-3xl p-8 sm:p-12 text-foreground max-w-lg mx-auto shadow-2xl">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Service fee per paid ticket</p>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl sm:text-6xl font-bold text-[#2969FF]">{pricing.percentage}</span>
                  {pricing.flatFeeValue > 0 && (
                    <>
                      <span className="text-3xl sm:text-4xl font-bold text-muted-foreground">+</span>
                      <span className="text-5xl sm:text-6xl font-bold text-[#2969FF]">{pricing.currency}{pricing.flatFee}</span>
                    </>
                  )}
                </div>
                <p className="text-muted-foreground mb-2">per ticket sold</p>
                {pricing.cap && (
                  <p className="text-sm text-muted-foreground mb-6">Capped at {pricing.currency}{pricing.cap} per order</p>
                )}
                {!pricing.cap && <div className="mb-6"></div>}
                
                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-2 mb-6">
                  <Zap className="w-4 h-4" />
                  <span className="font-semibold">{pricing.savings}</span>
                </div>
                
                <div className="pt-6 border-t border-border/10">
                  <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Free events = Free</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>No monthly fees</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link
                to="/organizer/register"
                className="inline-flex items-center gap-2 bg-card text-[#2969FF] font-semibold px-8 py-4 rounded-xl hover:bg-muted transition-all shadow-lg hover:shadow-xl"
              >
                Start for free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium px-8 py-4"
              >
                Browse events
              </Link>
            </div>
          </div>
        </div>
        
        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#2969FF] mb-2">{platformStats.eventsHosted}</div>
              <div className="text-muted-foreground">Events Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#2969FF] mb-2">{platformStats.ticketsSold}</div>
              <div className="text-muted-foreground">Tickets Sold</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#2969FF] mb-2">{Object.keys(pricingData).length || platformStats.countries}</div>
              <div className="text-muted-foreground">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#2969FF] mb-2">{platformStats.organizers}</div>
              <div className="text-muted-foreground">Organizers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed for event organizers worldwide, built by people who understand your market.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureCards.map((card, index) => (
              <div 
                key={index}
                className="group bg-card rounded-2xl p-8 border border-border/10 hover:border-[#2969FF]/20 hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Why organizers choose Ticketrack
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              More features, lower fees, better support. See how we compare.
            </p>
          </div>

          <div className="bg-card rounded-3xl shadow-xl overflow-hidden max-w-4xl mx-auto">
            {/* Table Header */}
            <div className="grid grid-cols-3 bg-background border-b border-border/10">
              <div className="p-6 font-semibold text-muted-foreground">Feature</div>
              <div className="p-6 text-center">
                <Link to="/" className="inline-flex items-center justify-center bg-[#2969FF] text-white rounded-full px-4 py-1 hover:opacity-90 transition-opacity">
                  <Logo className="h-5" variant="light" />
                </Link>
              </div>
              <div className="p-6 text-center font-semibold text-muted-foreground">Others</div>
            </div>

            {/* Table Body */}
            {featureComparison.map((row, index) => (
              <div 
                key={index}
                className={`grid grid-cols-3 border-b border-gray-50 hover:bg-background/50 transition-colors ${
                  index % 2 === 0 ? 'bg-card' : 'bg-background/30'
                }`}
              >
                <div className="p-4 sm:p-6 text-foreground/80 flex items-center">
                  {row.feature}
                </div>
                <div className="p-4 sm:p-6 flex items-center justify-center">
                  {row.ticketrack ? (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <X className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-6 flex items-center justify-center">
                  {row.others ? (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <X className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Details Section - Now Dynamic! */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              No surprises. No hidden fees. Just straightforward pricing across all regions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.entries(pricingData).map(([code, data]) => (
              <div 
                key={code}
                className={`rounded-2xl p-6 border-2 transition-all hover:shadow-lg ${
                  selectedCountry === code 
                    ? 'border-[#2969FF] bg-[#2969FF]/5' 
                    : 'border-border/10 bg-card hover:border-border/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{data.flag}</span>
                  <span className="font-bold text-foreground">{data.country}</span>
                </div>
                <div className="text-2xl font-bold text-[#2969FF] mb-2">
                  {data.percentage}
                  {data.flatFeeValue > 0 && ` + ${data.currency}${data.flatFee}`}
                </div>
                <p className="text-sm text-muted-foreground mb-4">per paid ticket</p>
                <div className="inline-flex items-center gap-1 text-sm text-green-600 bg-green-50 rounded-full px-3 py-1">
                  <Zap className="w-3 h-3" />
                  {data.savings}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              All this included. No extra cost.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Ticket, title: 'Unlimited Events', desc: 'Create as many events as you want' },
              { icon: Users, title: 'Unlimited Attendees', desc: 'No caps on ticket sales' },
              { icon: CreditCard, title: 'Multiple Payment Options', desc: 'Cards, bank transfers, mobile money' },
              { icon: Mail, title: 'Email Communications', desc: 'Send updates to all attendees' },
              { icon: QrCode, title: 'QR Check-in', desc: 'Fast, reliable check-in system' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Track performance in real-time' },
              { icon: RefreshCw, title: 'Refund Management', desc: 'Process refunds seamlessly' },
              { icon: Shield, title: 'Secure Payments', desc: 'PCI-DSS compliant processing' },
              { icon: Smartphone, title: 'Mobile Optimized', desc: 'Beautiful on every device' },
              { icon: Clock, title: 'Instant Payouts', desc: 'Get paid within 24-48 hours' },
              { icon: Calendar, title: 'Recurring Events', desc: 'Set up event series easily' },
              { icon: MessageCircle, title: '24/7 Support', desc: 'We are here when you need us' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4 bg-card rounded-xl p-5 border border-border/10">
                <div className="w-10 h-10 bg-[#2969FF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-[#2969FF]" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Loved by event organizers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Ticketrack helped us sell out our concert in just 3 days. The multi-currency support is a game changer for reaching fans worldwide.",
                name: "Adaeze O.",
                role: "Music Event Organizer",
                location: "Lagos, Nigeria"
              },
              {
                quote: "Finally, a ticketing platform that understands the modern event industry. Mobile money integration and affordable fees make all the difference.",
                name: "Kwame A.",
                role: "Festival Director",
                location: "Accra, Ghana"
              },
              {
                quote: "The waitlist feature alone saved us from losing hundreds of potential ticket sales. Our events now consistently sell out.",
                name: "Thabo M.",
                role: "Conference Organizer",
                location: "Johannesburg, SA"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-card rounded-2xl p-8 border border-border/10 hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <p className="text-sm text-[#2969FF]">{testimonial.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Is it really free to create events?",
                a: "Yes! Creating and publishing events is completely free. We only charge a small fee when you sell paid tickets. Free events have zero fees."
              },
              {
                q: "When do I get paid?",
                a: "We process payouts within 24-48 hours after your event ends. For ongoing events, you can request weekly payouts."
              },
              {
                q: "Can I pass fees to attendees?",
                a: "Absolutely. You can choose to absorb the fees yourself or pass them on to ticket buyers. It's your choice."
              },
              {
                q: "What payment methods do you support?",
                a: "We support card payments (Visa, Mastercard, Verve), bank transfers, and mobile money (M-Pesa, MTN, Airtel, etc.) depending on your region."
              },
              {
                q: "Is there a limit on ticket sales?",
                a: "No limits! Sell as many tickets as you want. Our platform is built to handle high-demand events."
              },
              {
                q: "Do you offer refunds on your fees?",
                a: "Yes, if you refund a ticket, we refund our fee too. Unlike some competitors, we don't keep fees on refunded tickets."
              }
            ].map((faq, index) => (
              <details 
                key={index}
                className="group bg-card rounded-2xl border border-border/10 overflow-hidden"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="font-semibold text-foreground">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-muted-foreground">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#2969FF] to-[#1e4fd4] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to sell more tickets?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Join thousands of successful event organizers worldwide. Start selling tickets in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/organizer/register"
              className="inline-flex items-center gap-2 bg-card text-[#2969FF] font-semibold px-8 py-4 rounded-xl hover:bg-muted transition-all shadow-lg"
            >
              Get started for free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium px-8 py-4 border border-white/30 rounded-xl hover:border-white/50 transition-all"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
