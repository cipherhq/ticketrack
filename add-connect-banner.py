#!/usr/bin/env python3
"""
Add Stripe Connect promotion banner to OrganizerHome.jsx
"""

file_path = '/Users/bajideace/Desktop/ticketrack/src/pages/organizer/OrganizerHome.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Zap and X icons to imports
old_import = "import { DollarSign, Users, Calendar, TrendingUp, Plus, Eye, Download, Link2, ShoppingCart, Loader2 } from 'lucide-react';"
new_import = "import { DollarSign, Users, Calendar, TrendingUp, Plus, Eye, Download, Link2, ShoppingCart, Loader2, Zap, X } from 'lucide-react';"
content = content.replace(old_import, new_import)

# 2. Add state for banner dismissal after other states
old_state = "const [defaultCurrency, setDefaultCurrency] = useState('USD'); // Fallback from user's country"
new_state = """const [defaultCurrency, setDefaultCurrency] = useState('USD'); // Fallback from user's country
  const [showConnectBanner, setShowConnectBanner] = useState(false);
  const [connectCountries, setConnectCountries] = useState([]);"""
content = content.replace(old_state, new_state)

# 3. Add banner check logic in loadDashboardData
old_load = """const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's default currency from their country
      if (organizer?.user_id) {
        const currency = await getUserDefaultCurrency(supabase, organizer.user_id);
        if (currency) setDefaultCurrency(currency);
      }
      
      await Promise.all([
        loadStats(),
        loadUpcomingEvents(),
        loadPromoterData(),
      ]);"""

new_load = """const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's default currency from their country
      if (organizer?.user_id) {
        const currency = await getUserDefaultCurrency(supabase, organizer.user_id);
        if (currency) setDefaultCurrency(currency);
      }
      
      // Check if Connect banner should show
      await checkConnectBannerVisibility();
      
      await Promise.all([
        loadStats(),
        loadUpcomingEvents(),
        loadPromoterData(),
      ]);"""
content = content.replace(old_load, new_load)

# 4. Add the banner check function before loadStats
old_loadstats = "  const loadStats = async () => {"
new_loadstats = """  const checkConnectBannerVisibility = async () => {
    try {
      // Check if banner was dismissed
      const dismissed = localStorage.getItem('connect_banner_dismissed');
      if (dismissed) return;

      // Check if organizer already has Connect
      if (organizer?.stripe_connect_status === 'active' || organizer?.stripe_connect_id) return;

      // Get Connect settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['stripe_connect_enabled', 'stripe_connect_countries']);

      const enabled = settings?.find(s => s.key === 'stripe_connect_enabled')?.value === 'true';
      const countries = JSON.parse(settings?.find(s => s.key === 'stripe_connect_countries')?.value || '[]');
      
      if (!enabled || countries.length === 0) return;
      
      setConnectCountries(countries);

      // Check if organizer's country is eligible
      if (organizer?.country_code && countries.includes(organizer.country_code)) {
        setShowConnectBanner(true);
      }
    } catch (error) {
      console.error('Error checking Connect banner:', error);
    }
  };

  const dismissConnectBanner = () => {
    localStorage.setItem('connect_banner_dismissed', 'true');
    setShowConnectBanner(false);
  };

  const loadStats = async () => {"""
content = content.replace(old_loadstats, new_loadstats)

# 5. Add the banner in the render section after loading check
old_return = """  return (
    <div className="space-y-6">
      {/* Revenue by Currency */}"""

new_return = """  return (
    <div className="space-y-6">
      {/* Stripe Connect Promotion Banner */}
      {showConnectBanner && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 p-6 text-white shadow-lg">
          <button
            onClick={dismissConnectBanner}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-8 h-8" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Get Paid Faster with Stripe Connect</h3>
              <p className="text-white/90 text-sm mb-3">
                Connect your Stripe account to receive ticket sales directly. Payouts are automatic, 
                and you can process refunds instantly from your dashboard.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-white/80">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Direct payouts to your bank
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  2-3 day transfers after events
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Instant refund processing
                </span>
              </div>
            </div>
            
            <Link
              to="/organizer/stripe-connect"
              className="flex-shrink-0 px-6 py-3 bg-white text-purple-700 font-semibold rounded-xl hover:bg-purple-50 transition-colors shadow-md"
            >
              Set Up Now
            </Link>
          </div>
        </div>
      )}

      {/* Revenue by Currency */}"""
content = content.replace(old_return, new_return)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ Connect promotion banner added to OrganizerHome!")
print("   - Shows only for eligible countries (US, GB, CA)")
print("   - Only shows if organizer hasn't connected yet")
print("   - Dismissible (saves to localStorage)")
print("   - Professional gradient design")
