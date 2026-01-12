#!/usr/bin/env python3
"""
Script to update AdminRefunds.jsx to handle Stripe Connect refunds
"""

file_path = '/Users/bajideace/Desktop/ticketrack/src/pages/admin/AdminRefunds.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Zap icon to imports (for Connect indicator)
content = content.replace(
    "import { Search, Loader2, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, CreditCard, Eye } from 'lucide-react';",
    "import { Search, Loader2, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, CreditCard, Eye, Zap } from 'lucide-react';"
)

# 2. Update the order select to include is_stripe_connect
content = content.replace(
    "order:orders(id, order_number, payment_reference, payment_provider)",
    "order:orders(id, order_number, payment_reference, payment_provider, is_stripe_connect)"
)

# 3. Update stats to show Connect processed separately
old_stats = """      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending' || r.organizer_decision === 'pending').length || 0;
      const approved = data?.filter(r => r.status === 'approved' && !r.refund_reference).length || 0;
      const rejected = data?.filter(r => r.status === 'rejected').length || 0;
      const processed = data?.filter(r => r.refund_reference).length || 0;
      const escalated = data?.filter(r => r.escalated_to_admin && !r.refund_reference).length || 0;
      const totalAmount = data?.filter(r => r.refund_reference).reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      setStats({ pending, approved, rejected, processed, escalated, total: data?.length || 0, totalAmount });"""

new_stats = """      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending' || r.organizer_decision === 'pending').length || 0;
      const approved = data?.filter(r => r.status === 'approved' && !r.refund_reference && !r.order?.is_stripe_connect).length || 0;
      const rejected = data?.filter(r => r.status === 'rejected').length || 0;
      const processed = data?.filter(r => r.refund_reference || r.status === 'processed').length || 0;
      const escalated = data?.filter(r => r.escalated_to_admin && !r.refund_reference).length || 0;
      const connectProcessed = data?.filter(r => r.order?.is_stripe_connect && (r.refund_reference || r.status === 'processed')).length || 0;
      const totalAmount = data?.filter(r => r.refund_reference || r.status === 'processed').reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      setStats({ pending, approved, rejected, processed, escalated, connectProcessed, total: data?.length || 0, totalAmount });"""

content = content.replace(old_stats, new_stats)

# 4. Add filter option for Connect
old_filter_options = """            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Ready to Process</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>"""

new_filter_options = """            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Ready to Process</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="connect">Connect (Organizer Handled)</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>"""

content = content.replace(old_filter_options, new_filter_options)

# 5. Update filter logic to handle Connect filter
old_filter_logic = """    if (statusFilter === 'escalated' && !r.escalated_to_admin) return false;"""

new_filter_logic = """    if (statusFilter === 'escalated' && !r.escalated_to_admin) return false;
    if (statusFilter === 'connect' && !r.order?.is_stripe_connect) return false;"""

content = content.replace(old_filter_logic, new_filter_logic)

# 6. Update getStatusBadge to show Connect status
old_status_badge = """  const getStatusBadge = (refund) => {
    if (refund.refund_reference) return <Badge className="bg-green-100 text-green-700">Processed</Badge>;
    if (refund.escalated_to_admin && refund.status !== 'approved') return <Badge className="bg-purple-100 text-purple-700">⚠️ Escalated</Badge>;
    if (refund.status === 'approved') return <Badge className="bg-blue-100 text-blue-700">Approved - Pending Payment</Badge>;
    if (refund.status === 'rejected') return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
    if (refund.organizer_decision === 'pending') return <Badge className="bg-yellow-100 text-yellow-700">Awaiting Organizer</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>;
  };"""

new_status_badge = """  const getStatusBadge = (refund) => {
    if (refund.refund_reference || refund.status === 'processed') return <Badge className="bg-green-100 text-green-700">Processed</Badge>;
    if (refund.escalated_to_admin && refund.status !== 'approved') return <Badge className="bg-purple-100 text-purple-700">⚠️ Escalated</Badge>;
    if (refund.status === 'approved') return <Badge className="bg-blue-100 text-blue-700">Approved - Pending Payment</Badge>;
    if (refund.status === 'rejected') return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
    if (refund.organizer_decision === 'pending') return <Badge className="bg-yellow-100 text-yellow-700">Awaiting Organizer</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>;
  };

  const getConnectBadge = (refund) => {
    if (refund.order?.is_stripe_connect) {
      return <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit"><Zap className="w-3 h-3" />Connect</Badge>;
    }
    return null;
  };"""

content = content.replace(old_status_badge, new_status_badge)

# 7. Update the status display to show Connect badge
old_status_display = """{getStatusBadge(refund)}
                      </div>"""

new_status_display = """<div className="flex gap-2 flex-wrap">
                          {getConnectBadge(refund)}
                          {getStatusBadge(refund)}
                        </div>
                      </div>"""

content = content.replace(old_status_display, new_status_display)

# 8. Update Process button to hide for Connect refunds
old_process_btn = """{refund.status === 'approved' && !refund.refund_reference && (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl" onClick={() => setProcessModal({ open: true, refund })}>
                          <CreditCard className="w-4 h-4 mr-1" /> Process
                        </Button>
                      )}"""

new_process_btn = """{refund.status === 'approved' && !refund.refund_reference && !refund.order?.is_stripe_connect && (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl" onClick={() => setProcessModal({ open: true, refund })}>
                          <CreditCard className="w-4 h-4 mr-1" /> Process
                        </Button>
                      )}
                      {refund.order?.is_stripe_connect && !refund.refund_reference && refund.status !== 'processed' && refund.status !== 'rejected' && (
                        <Badge className="bg-purple-50 text-purple-600 text-xs">Organizer Handles</Badge>
                      )}"""

content = content.replace(old_process_btn, new_process_btn)

# 9. Add Connect info to detail modal
old_detail_provider = """<div><p className="text-[#0F0F0F]/60">Payment Provider</p><p className="font-medium capitalize">{detailModal.refund.order?.payment_provider || 'N/A'}</p></div>"""

new_detail_provider = """<div><p className="text-[#0F0F0F]/60">Payment Provider</p><p className="font-medium capitalize">{detailModal.refund.order?.payment_provider || 'N/A'}</p></div>
                {detailModal.refund.order?.is_stripe_connect && <div><p className="text-[#0F0F0F]/60">Type</p><Badge className="bg-purple-100 text-purple-700"><Zap className="w-3 h-3 inline mr-1" />Stripe Connect</Badge></div>}"""

content = content.replace(old_detail_provider, new_detail_provider)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ AdminRefunds.jsx updated successfully!")
print("   - Added Zap icon import")
print("   - Added is_stripe_connect to order query")
print("   - Updated stats for Connect")
print("   - Added Connect filter option")
print("   - Updated status badge logic")
print("   - Added Connect badge display")
print("   - Hide Process button for Connect refunds")
print("   - Added Connect info to detail modal")
