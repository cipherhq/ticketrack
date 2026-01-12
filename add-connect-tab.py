#!/usr/bin/env python3
"""
Add Stripe Connect tab to AdminSettings.jsx
"""

file_path = '/Users/bajideace/Desktop/ticketrack/src/pages/admin/AdminSettings.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add the Connect tab trigger after Limits
old_limits_tab = '''          <TabsTrigger value="limits" className="rounded-lg data-[state=active]:bg-white">
            <Gauge className="w-4 h-4 mr-2" /> Limits
          </TabsTrigger>
        </TabsList>'''

new_limits_tab = '''          <TabsTrigger value="limits" className="rounded-lg data-[state=active]:bg-white">
            <Gauge className="w-4 h-4 mr-2" /> Limits
          </TabsTrigger>
          <TabsTrigger value="connect" className="rounded-lg data-[state=active]:bg-white">
            <Zap className="w-4 h-4 mr-2" /> Stripe Connect
          </TabsTrigger>
        </TabsList>'''

content = content.replace(old_limits_tab, new_limits_tab)

# 2. Find where TabsContent for limits ends and add Connect tab content
# Look for the closing of the limits TabsContent

connect_tab_content = '''
        {/* STRIPE CONNECT TAB */}
        <TabsContent value="connect" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Stripe Connect Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Global Toggle */}
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-purple-900">Enable Stripe Connect</h4>
                    <p className="text-sm text-purple-700">Allow organizers in supported countries to receive direct payouts</p>
                  </div>
                  <Switch
                    checked={platformSettings.find(s => s.key === 'stripe_connect_enabled')?.value === 'true'}
                    onCheckedChange={async (checked) => {
                      const newValue = checked ? 'true' : 'false';
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_enabled' ? { ...s, value: newValue } : s));
                      await supabase.from('platform_settings').update({ value: newValue, updated_at: new Date().toISOString() }).eq('key', 'stripe_connect_enabled');
                      setSavedKey('stripe_connect_enabled');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                  />
                </div>
                {savedKey === 'stripe_connect_enabled' && <span className="text-xs text-green-600 mt-2 block">Saved!</span>}
              </div>

              {/* Settings Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Platform Fee */}
                <div className="p-4 bg-white rounded-xl border border-[#0F0F0F]/10">
                  <Label className="text-sm font-medium">Platform Fee (%)</Label>
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Percentage charged on each Connect transaction</p>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={platformSettings.find(s => s.key === 'stripe_connect_platform_fee_percentage')?.value || '5'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_platform_fee_percentage' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await supabase.from('platform_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('key', 'stripe_connect_platform_fee_percentage');
                      setSavedKey('stripe_connect_platform_fee_percentage');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_platform_fee_percentage' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Minimum Payout */}
                <div className="p-4 bg-white rounded-xl border border-[#0F0F0F]/10">
                  <Label className="text-sm font-medium">Minimum Payout ($)</Label>
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Minimum balance required before auto-payout triggers</p>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={platformSettings.find(s => s.key === 'stripe_connect_minimum_payout')?.value || '10'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_minimum_payout' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await supabase.from('platform_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('key', 'stripe_connect_minimum_payout');
                      setSavedKey('stripe_connect_minimum_payout');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_minimum_payout' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Payout Delay */}
                <div className="p-4 bg-white rounded-xl border border-[#0F0F0F]/10">
                  <Label className="text-sm font-medium">Payout Delay (days)</Label>
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Days after event ends before payout is released</p>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    value={platformSettings.find(s => s.key === 'stripe_connect_payout_delay_days')?.value || '3'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_payout_delay_days' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await supabase.from('platform_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('key', 'stripe_connect_payout_delay_days');
                      setSavedKey('stripe_connect_payout_delay_days');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_payout_delay_days' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Supported Countries */}
                <div className="p-4 bg-white rounded-xl border border-[#0F0F0F]/10">
                  <Label className="text-sm font-medium">Supported Countries</Label>
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Countries where Connect is available (JSON array)</p>
                  <Input
                    value={platformSettings.find(s => s.key === 'stripe_connect_countries')?.value || '["US","GB","CA"]'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_countries' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await supabase.from('platform_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('key', 'stripe_connect_countries');
                      setSavedKey('stripe_connect_countries');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg font-mono text-sm"
                  />
                  {savedKey === 'stripe_connect_countries' && <span className="text-xs text-green-600">Saved!</span>}
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">How Stripe Connect Works</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>Organizers in supported countries can connect their Stripe account</li>
                  <li>Customer payments go directly to the organizer's Stripe (minus platform fee)</li>
                  <li>Payouts to bank accounts are triggered automatically after events end</li>
                  <li>Organizers can process refunds directly from their dashboard</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
'''

# Find the position to insert - after the last TabsContent (before modals)
# Look for "      {/* Currency Modal */}"
old_modal_start = "      {/* Currency Modal */}"
new_modal_start = connect_tab_content + "\n      {/* Currency Modal */}"

content = content.replace(old_modal_start, new_modal_start)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ Stripe Connect tab added to AdminSettings!")
print("   - Added 'connect' tab trigger")
print("   - Added Connect settings panel with:")
print("     - Global enable/disable toggle")
print("     - Platform fee percentage")
print("     - Minimum payout threshold")
print("     - Payout delay days")
print("     - Supported countries")
