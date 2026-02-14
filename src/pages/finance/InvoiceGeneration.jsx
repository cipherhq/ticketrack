import { useState, useEffect } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, FileText, Download, Send, Eye, Plus,
  Calendar, RefreshCw, CheckCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function InvoiceGeneration() {
  const { logFinanceAction } = useFinance();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    organizer_id: '',
    period_start: '',
    period_end: ''
  });

  useEffect(() => {
    loadInvoices();
    loadOrganizers();
    logFinanceAction('view_invoice_generation');
  }, [statusFilter]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('organizer_invoices')
        .select(`
          *,
          organizers (id, business_name, email)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizers = async () => {
    try {
      const { data } = await supabase
        .from('organizers')
        .select('id, business_name, email')
        .eq('status', 'approved')
        .order('business_name');

      setOrganizers(data || []);
    } catch (error) {
      console.error('Error loading organizers:', error);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!newInvoice.organizer_id || !newInvoice.period_start || !newInvoice.period_end) {
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke('generate-invoice', {
        body: {
          organizer_id: newInvoice.organizer_id,
          period_start: newInvoice.period_start,
          period_end: newInvoice.period_end
        }
      });

      if (response.error) throw response.error;

      logFinanceAction('generate_invoice', {
        organizer_id: newInvoice.organizer_id,
        period: `${newInvoice.period_start} to ${newInvoice.period_end}`
      });

      setGenerateDialogOpen(false);
      setNewInvoice({ organizer_id: '', period_start: '', period_end: '' });
      loadInvoices();
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!(await confirm('Generate Invoices', 'Generate invoices for all organizers with earnings in the current month?'))) {
      return;
    }

    setGenerating(true);
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split('T')[0];
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split('T')[0];

      const response = await supabase.functions.invoke('generate-invoice', {
        body: {
          bulk: true,
          period_start: periodStart,
          period_end: periodEnd
        }
      });

      if (response.error) throw response.error;

      logFinanceAction('bulk_generate_invoices', { period: `${periodStart} to ${periodEnd}` });
      loadInvoices();
    } catch (error) {
      console.error('Error bulk generating:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (!invoice) return;

      // Send email with invoice
      await supabase.functions.invoke('send-email', {
        body: {
          to: invoice.organizers?.email,
          template: 'organizer_invoice',
          data: {
            invoice_number: invoice.invoice_number,
            period_start: invoice.period_start,
            period_end: invoice.period_end,
            gross_sales: invoice.gross_sales,
            platform_fees: invoice.platform_fees,
            net_earnings: invoice.net_earnings,
            currency: invoice.currency
          }
        }
      });

      await supabase
        .from('organizer_invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      logFinanceAction('send_invoice', { invoice_id: invoiceId });
      loadInvoices();
    } catch (error) {
      console.error('Error sending invoice:', error);
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      if (invoice.pdf_path) {
        const { data } = supabase.storage
          .from('invoices')
          .getPublicUrl(invoice.pdf_path);

        window.open(data.publicUrl, '_blank');
      } else {
        // Generate and download HTML invoice
        const html = generateInvoiceHTML(invoice);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.invoice_number}.html`;
        a.click();
      }

      logFinanceAction('download_invoice', { invoice_id: invoice.id });
    } catch (error) {
      console.error('Error downloading:', error);
    }
  };

  const generateInvoiceHTML = (invoice) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #2969FF; }
    .invoice-info { text-align: right; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 14px; color: #666; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f8f8; }
    .amount { text-align: right; }
    .total { font-size: 18px; font-weight: bold; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Ticketrack</div>
    <div class="invoice-info">
      <h2>Earnings Statement</h2>
      <p>Invoice #: ${invoice.invoice_number}</p>
      <p>Date: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">BILL TO</div>
    <strong>${invoice.organizers?.business_name || 'Organizer'}</strong><br>
    ${invoice.organizers?.email || ''}
  </div>

  <div class="section">
    <div class="section-title">PERIOD</div>
    ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Gross Ticket Sales</td>
        <td class="amount">${formatPrice(invoice.gross_sales, invoice.currency)}</td>
      </tr>
      <tr>
        <td>Platform Fees</td>
        <td class="amount">-${formatPrice(invoice.platform_fees, invoice.currency)}</td>
      </tr>
      <tr class="total">
        <td>Net Earnings</td>
        <td class="amount">${formatPrice(invoice.net_earnings, invoice.currency)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Thank you for using Ticketrack!</p>
    <p>This is an automatically generated earnings statement.</p>
  </div>
</body>
</html>
    `;
  };

  const handlePreviewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setPreviewDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-muted text-foreground',
      generated: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800',
      paid: 'bg-purple-100 text-purple-800'
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Generation</h1>
          <p className="text-muted-foreground">Generate and manage organizer earnings statements</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBulkGenerate}
            disabled={generating}
            className="rounded-xl"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Bulk Generate
          </Button>
          <Button
            onClick={() => setGenerateDialogOpen(true)}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'draft').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Send className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'sent').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">
                  {formatMultiCurrencyCompact(
                    invoices.reduce((acc, i) => {
                      const currency = i.currency || 'USD';
                      acc[currency] = (acc[currency] || 0) + parseFloat(i.net_earnings || 0);
                      return acc;
                    }, {})
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.organizers?.business_name || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(invoice.period_start).toLocaleDateString()} -
                    {new Date(invoice.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(invoice.gross_sales, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    -{formatPrice(invoice.platform_fees, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    {formatPrice(invoice.net_earnings, invoice.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePreviewInvoice(invoice)}
                        className="rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadInvoice(invoice)}
                        className="rounded-lg"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {invoice.status !== 'sent' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="rounded-lg"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No invoices generated yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organizer</label>
              <Select
                value={newInvoice.organizer_id}
                onValueChange={(v) => setNewInvoice({ ...newInvoice, organizer_id: v })}
              >
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Select organizer" />
                </SelectTrigger>
                <SelectContent>
                  {organizers.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Period Start</label>
                <Input
                  type="date"
                  value={newInvoice.period_start}
                  onChange={(e) => setNewInvoice({ ...newInvoice, period_start: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Period End</label>
                <Input
                  type="date"
                  value={newInvoice.period_end}
                  onChange={(e) => setNewInvoice({ ...newInvoice, period_end: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <Button
              onClick={handleGenerateInvoice}
              disabled={generating || !newInvoice.organizer_id}
              className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generate Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div
              dangerouslySetInnerHTML={{ __html: generateInvoiceHTML(selectedInvoice) }}
              className="bg-card p-4 rounded-xl border max-h-[600px] overflow-y-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
