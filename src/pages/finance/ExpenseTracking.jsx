import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Loader2, Plus, Receipt, CheckCircle, XCircle, Clock,
  Download, Upload, Calendar, TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

const EXPENSE_CATEGORIES = [
  'infrastructure',
  'marketing',
  'payroll',
  'software',
  'legal',
  'office',
  'travel',
  'payment_fees',
  'other'
];

export function ExpenseTracking() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    currency: 'NGN',
    expense_date: '',
    vendor: '',
    is_recurring: false
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [stats, setStats] = useState({
    totalExpenses: 0,
    pendingExpenses: 0,
    approvedExpenses: 0,
    thisMonth: 0
  });

  useEffect(() => {
    loadExpenses();
    logFinanceAction('view_expense_tracking');
  }, [categoryFilter, statusFilter]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('platform_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (dateRange.start) {
        query = query.gte('expense_date', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('expense_date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);

      // Calculate stats
      const total = data?.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0;
      const pending = data?.filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0;
      const approved = data?.filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = data?.filter(e => new Date(e.expense_date) >= startOfMonth)
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0;

      setStats({
        totalExpenses: total,
        pendingExpenses: pending,
        approvedExpenses: approved,
        thisMonth
      });
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.category || !newExpense.amount || !newExpense.expense_date) {
      return;
    }

    setSubmitting(true);
    try {
      let receiptPath = null;

      if (receiptFile) {
        const fileName = `${Date.now()}_${receiptFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(fileName, receiptFile);

        if (!uploadError) {
          receiptPath = fileName;
        }
      }

      const { error } = await supabase
        .from('platform_expenses')
        .insert({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
          receipt_path: receiptPath,
          status: 'pending'
        });

      if (error) throw error;

      logFinanceAction('add_expense', {
        category: newExpense.category,
        amount: newExpense.amount
      });

      setAddDialogOpen(false);
      setNewExpense({
        category: '',
        description: '',
        amount: '',
        currency: 'NGN',
        expense_date: '',
        vendor: '',
        is_recurring: false
      });
      setReceiptFile(null);
      loadExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveExpense = async (expenseId) => {
    try {
      await supabase
        .from('platform_expenses')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', expenseId);

      logFinanceAction('approve_expense', { expense_id: expenseId });
      loadExpenses();
    } catch (error) {
      console.error('Error approving expense:', error);
    }
  };

  const handleRejectExpense = async (expenseId) => {
    try {
      await supabase
        .from('platform_expenses')
        .update({ status: 'rejected' })
        .eq('id', expenseId);

      logFinanceAction('reject_expense', { expense_id: expenseId });
      loadExpenses();
    } catch (error) {
      console.error('Error rejecting expense:', error);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Currency', 'Status', 'Recurring'].join(','),
      ...expenses.map(e => [
        e.expense_date,
        e.category,
        `"${e.description || ''}"`,
        `"${e.vendor || ''}"`,
        e.amount,
        e.currency,
        e.status,
        e.is_recurring ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logFinanceAction('export_expenses');
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getCategoryColor = (category) => {
    const colors = {
      infrastructure: 'bg-blue-100 text-blue-800',
      marketing: 'bg-purple-100 text-purple-800',
      payroll: 'bg-green-100 text-green-800',
      software: 'bg-indigo-100 text-indigo-800',
      legal: 'bg-gray-100 text-gray-800',
      office: 'bg-orange-100 text-orange-800',
      travel: 'bg-cyan-100 text-cyan-800',
      payment_fees: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatCategory = (category) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Expense Tracking</h1>
          <p className="text-[#0F0F0F]/60">Track and manage platform operating expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Expenses</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.totalExpenses, 'NGN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.pendingExpenses, 'NGN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Approved</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.approvedExpenses, 'NGN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">This Month</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.thisMonth, 'NGN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-[140px] rounded-xl"
              />
              <span className="text-[#0F0F0F]/40">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-[140px] rounded-xl"
              />
              <Button onClick={loadExpenses} size="sm" className="rounded-xl">
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Expenses ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getCategoryColor(expense.category)}>
                      {formatCategory(expense.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {expense.description || '-'}
                  </TableCell>
                  <TableCell>{expense.vendor || '-'}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatPrice(expense.amount, expense.currency)}
                    {expense.is_recurring && (
                      <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs">
                        Recurring
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(expense.status)}</TableCell>
                  <TableCell>
                    {expense.receipt_path ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const { data } = supabase.storage
                            .from('expense-receipts')
                            .getPublicUrl(expense.receipt_path);
                          window.open(data.publicUrl, '_blank');
                        }}
                        className="rounded-lg"
                      >
                        <Receipt className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-[#0F0F0F]/40">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleApproveExpense(expense.id)}
                          className="bg-green-600 hover:bg-green-700 rounded-lg"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectExpense(expense.id)}
                          className="rounded-lg"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#0F0F0F]/60">
                    No expenses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newExpense.category}
                  onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{formatCategory(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the expense..."
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="mt-1 rounded-xl"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Currency</label>
                <Select
                  value={newExpense.currency}
                  onValueChange={(v) => setNewExpense({ ...newExpense, currency: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Vendor</label>
              <Input
                placeholder="Vendor name"
                value={newExpense.vendor}
                onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Receipt (optional)</label>
              <Input
                type="file"
                onChange={(e) => setReceiptFile(e.target.files?.[0])}
                className="mt-1 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={newExpense.is_recurring}
                onChange={(e) => setNewExpense({ ...newExpense, is_recurring: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="recurring" className="text-sm">This is a recurring expense</label>
            </div>

            <Button
              onClick={handleAddExpense}
              disabled={submitting || !newExpense.category || !newExpense.amount}
              className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
