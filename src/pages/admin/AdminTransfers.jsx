import { useState, useEffect } from 'react'
import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'
import { 
  Search, ArrowRightLeft, Download, RefreshCw, Loader2, Eye, Copy, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 20

export function AdminTransfers() {
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({ total: 0, paid: 0, free: 0, feesByCurrency: {} })
  const [detailModal, setDetailModal] = useState({ open: false, transfer: null })
  const [copied, setCopied] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadTransfers()
  }, [page])

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const { count: total } = await supabase
        .from('ticket_transfers')
        .select('*', { count: 'exact', head: true })
      
      const { count: paid } = await supabase
        .from('ticket_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'paid')
      
      // Get fees with currency
      const { data: feeData } = await supabase
        .from('ticket_transfers')
        .select('fee_amount, currency')
      
      // Group fees by currency
      const feesByCurrency = {};
      (feeData || []).forEach(t => {
        const currency = t.currency || 'NGN';
        if (!feesByCurrency[currency]) feesByCurrency[currency] = 0;
        feesByCurrency[currency] += parseFloat(t.fee_amount) || 0;
      });
      
      setStats({ 
        total: total || 0, 
        paid: paid || 0, 
        free: (total || 0) - (paid || 0), 
        feesByCurrency 
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const loadTransfers = async () => {
    setLoading(true)
    try {
      // Get total count
      const { count } = await supabase
        .from('ticket_transfers')
        .select('*', { count: 'exact', head: true })

      setTotalCount(count || 0)

      // Get paginated data with all related data in a SINGLE query
      // This avoids N+1 queries (was: 61 queries for 20 items, now: 1 query)
      const { data, error } = await supabase
        .from('ticket_transfers')
        .select(`
          *,
          ticket:tickets!ticket_id (
            id, ticket_code, attendee_name, attendee_email, total_price, payment_reference,
            event:events (id, title, slug, currency)
          ),
          from_user:profiles!from_user_id (id, full_name, email, phone),
          to_user:profiles!to_user_id (id, full_name, email, phone)
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (error) throw error

      setTransfers(data || [])
    } catch (err) {
      console.error('Error loading transfers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransfers = transfers.filter(t => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      t.transfer_reference?.toLowerCase().includes(search) ||
      t.old_ticket_code?.toLowerCase().includes(search) ||
      t.new_ticket_code?.toLowerCase().includes(search) ||
      t.from_user?.full_name?.toLowerCase().includes(search) ||
      t.from_user?.email?.toLowerCase().includes(search) ||
      t.to_user?.full_name?.toLowerCase().includes(search) ||
      t.to_user?.email?.toLowerCase().includes(search) ||
      t.ticket?.event?.title?.toLowerCase().includes(search) ||
      t.original_transaction_id?.toLowerCase().includes(search) ||
      t.payment_reference?.toLowerCase().includes(search)
    )
  })

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(''), 2000)
  }

  const exportCSV = async () => {
    // Fetch all for export
    const { data } = await supabase
      .from('ticket_transfers')
      .select('*')
      .order('created_at', { ascending: false })
    
    const headers = ['Transfer ID', 'Date', 'Old Ticket', 'New Ticket', 'Original Tx', 'Fee', 'Fee Currency', 'Payment Ref', 'Status']
    const rows = (data || []).map(t => [
      t.transfer_reference || '',
      new Date(t.created_at).toLocaleString(),
      t.old_ticket_code || '',
      t.new_ticket_code || '',
      t.original_transaction_id || '',
      t.fee_amount || '0',
      t.fee_currency || '',
      t.payment_reference || '',
      t.payment_status || 'free'
    ])

    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ticket-transfers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const CopyButton = ({ text, field }) => (
    <button 
      onClick={() => copyToClipboard(text, field)}
      className="ml-2 text-[#0F0F0F]/40 hover:text-[#2969FF]"
    >
      {copied === field ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Ticket Transfers</h1>
          <p className="text-[#0F0F0F]/60">Audit trail for all ticket transfers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { setPage(0); loadTransfers(); loadStats(); }} className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportCSV} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Transfers</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Paid Transfers</p>
                <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
              </div>
              <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Free Transfers</p>
                <p className="text-2xl font-bold text-blue-600">{stats.free}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-0">Free</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Fees Collected</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">
                  {Object.entries(stats.feesByCurrency || {}).filter(([_, amt]) => amt > 0).length > 0
                    ? Object.entries(stats.feesByCurrency).filter(([_, amt]) => amt > 0).map(([curr, amt]) => formatPrice(amt, curr)).join(' + ')
                    : formatPrice(0, 'USD')}
                </p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-0">Revenue</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
        <Input
          placeholder="Search current page by transfer ID, ticket code, user name, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Table */}
      <Card className="border-0 rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <ArrowRightLeft className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No transfers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F4F6FA]">
                    <TableHead>Transfer ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Ticket Codes</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-[#F4F6FA]/50">
                      <TableCell className="font-mono text-xs text-purple-600">
                        {transfer.transfer_reference || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(transfer.created_at).toLocaleDateString()}<br/>
                        <span className="text-xs text-[#0F0F0F]/50">
                          {new Date(transfer.created_at).toLocaleTimeString()}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <span className="truncate block text-sm font-medium">
                          {transfer.ticket?.event?.title || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{transfer.from_user?.full_name || '-'}</div>
                        <div className="text-xs text-[#0F0F0F]/50">↓</div>
                        <div className="text-sm text-green-600">{transfer.to_user?.full_name || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs text-red-500 line-through">{transfer.old_ticket_code || '-'}</div>
                        <div className="font-mono text-xs text-green-600">{transfer.new_ticket_code || '-'}</div>
                      </TableCell>
                      <TableCell>
                        {transfer.fee_amount > 0 ? (
                          <span className="font-medium text-green-600">
                            {formatPrice(transfer.fee_amount, transfer.fee_currency)}
                          </span>
                        ) : (
                          <span className="text-[#0F0F0F]/40">Free</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          transfer.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-700 border-0'
                            : 'bg-blue-100 text-blue-700 border-0'
                        }>
                          {transfer.payment_status || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg"
                          onClick={() => setDetailModal({ open: true, transfer })}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#0F0F0F]/60">
            Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3">Page {page + 1} of {totalPages}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(o) => !o && setDetailModal({ open: false, transfer: null })}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              Transfer Details
            </DialogTitle>
          </DialogHeader>
          
          {detailModal.transfer && (
            <div className="space-y-6">
              {/* Transfer Info */}
              <div className="p-4 bg-purple-50 rounded-xl space-y-3">
                <h3 className="font-semibold text-purple-800">Transfer Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Transfer ID</p>
                    <p className="font-mono flex items-center">
                      {detailModal.transfer.transfer_reference || '-'}
                      {detailModal.transfer.transfer_reference && <CopyButton text={detailModal.transfer.transfer_reference} field="transfer_ref" />}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Date & Time</p>
                    <p>{new Date(detailModal.transfer.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Status</p>
                    <Badge className={
                      detailModal.transfer.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-700 border-0'
                        : 'bg-blue-100 text-blue-700 border-0'
                    }>
                      {detailModal.transfer.payment_status || 'free'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Event</p>
                    <p className="font-medium">{detailModal.transfer.ticket?.event?.title || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Ticket Codes */}
              <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
                <h3 className="font-semibold">Ticket Codes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 mb-1">Old Ticket (Invalidated)</p>
                    <p className="font-mono text-red-700 line-through flex items-center">
                      {detailModal.transfer.old_ticket_code || '-'}
                      {detailModal.transfer.old_ticket_code && <CopyButton text={detailModal.transfer.old_ticket_code} field="old_code" />}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600 mb-1">New Ticket (Active)</p>
                    <p className="font-mono text-green-700 flex items-center">
                      {detailModal.transfer.new_ticket_code || detailModal.transfer.ticket?.ticket_code || '-'}
                      {(detailModal.transfer.new_ticket_code || detailModal.transfer.ticket?.ticket_code) && 
                        <CopyButton text={detailModal.transfer.new_ticket_code || detailModal.transfer.ticket?.ticket_code} field="new_code" />}
                    </p>
                  </div>
                </div>
              </div>

              {/* From User */}
              <div className="p-4 bg-red-50/50 rounded-xl space-y-3">
                <h3 className="font-semibold text-red-800">From (Original Buyer)</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Name</p>
                    <p className="font-medium">{detailModal.transfer.from_user?.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Email</p>
                    <p className="flex items-center">
                      {detailModal.transfer.from_user?.email || '-'}
                      {detailModal.transfer.from_user?.email && <CopyButton text={detailModal.transfer.from_user.email} field="from_email" />}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Phone</p>
                    <p>{detailModal.transfer.from_user?.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">User ID</p>
                    <p className="font-mono text-xs">{detailModal.transfer.from_user_id?.slice(0, 8) || '-'}...</p>
                  </div>
                </div>
              </div>

              {/* To User */}
              <div className="p-4 bg-green-50/50 rounded-xl space-y-3">
                <h3 className="font-semibold text-green-800">To (New Ticket Holder)</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Name</p>
                    <p className="font-medium">{detailModal.transfer.to_user?.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Email</p>
                    <p className="flex items-center">
                      {detailModal.transfer.to_user?.email || '-'}
                      {detailModal.transfer.to_user?.email && <CopyButton text={detailModal.transfer.to_user.email} field="to_email" />}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Phone</p>
                    <p>{detailModal.transfer.to_user?.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">User ID</p>
                    <p className="font-mono text-xs">{detailModal.transfer.to_user_id?.slice(0, 8) || '-'}...</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 bg-amber-50/50 rounded-xl space-y-3">
                <h3 className="font-semibold text-amber-800">Payment & Transaction Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Original Purchase Tx</p>
                    <p className="font-mono text-xs flex items-center">
                      {detailModal.transfer.original_transaction_id || detailModal.transfer.ticket?.payment_reference || '-'}
                      {(detailModal.transfer.original_transaction_id || detailModal.transfer.ticket?.payment_reference) && 
                        <CopyButton text={detailModal.transfer.original_transaction_id || detailModal.transfer.ticket?.payment_reference} field="orig_tx" />}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Original Ticket Price</p>
                    <p>{formatPrice(detailModal.transfer.ticket?.total_price || 0, detailModal.transfer.ticket?.event?.currency || getDefaultCurrency(detailModal.transfer.ticket?.event?.country_code || detailModal.transfer.ticket?.event?.country))}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Transfer Fee</p>
                    <p className="font-medium">
                      {detailModal.transfer.fee_amount > 0 
                        ? formatPrice(detailModal.transfer.fee_amount, detailModal.transfer.fee_currency)
                        : 'Free'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Transfer Payment Ref</p>
                    <p className="font-mono text-xs flex items-center">
                      {detailModal.transfer.payment_reference || '-'}
                      {detailModal.transfer.payment_reference && <CopyButton text={detailModal.transfer.payment_reference} field="pay_ref" />}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
