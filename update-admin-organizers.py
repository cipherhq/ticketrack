#!/usr/bin/env python3
"""
Script to add Stripe Connect status column to AdminOrganizers.jsx
"""

import re

file_path = '/Users/bajideace/Desktop/ticketrack/src/pages/admin/AdminOrganizers.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add CreditCard to imports (after TrendingUp)
content = content.replace(
    'TrendingUp,\n  LogIn,',
    'TrendingUp,\n  CreditCard,\n  LogIn,'
)

# 2. Add Connect column header after KYC
content = content.replace(
    '<th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">KYC</th>\n                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>',
    '<th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">KYC</th>\n                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Connect</th>\n                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>'
)

# 3. Add Connect status cell after KYC cell (find the pattern and insert after)
old_pattern = '''{getKYCBadge(org.kyc_status, org.kyc_level)}
                    </td>
                    <td className="py-4 px-4">
                      {org.is_active !== false ? ('''

new_pattern = '''{getKYCBadge(org.kyc_status, org.kyc_level)}
                    </td>
                    <td className="py-4 px-4">
                      {org.stripe_connect_status === 'active' ? (
                        <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <CreditCard className="w-3 h-3" />Connected
                        </Badge>
                      ) : org.stripe_connect_status === 'pending' ? (
                        <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      ) : (
                        <span className="text-[#0F0F0F]/30">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {org.is_active !== false ? ('''

content = content.replace(old_pattern, new_pattern)

# 4. Update colspan for empty state (7 to 8)
content = content.replace('colSpan={7}', 'colSpan={8}')

with open(file_path, 'w') as f:
    f.write(content)

print("✅ AdminOrganizers.jsx updated successfully!")
print("   - Added CreditCard import")
print("   - Added Connect column header")
print("   - Added Connect status cell")
print("   - Updated colspan")
