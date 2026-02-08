import { useState, useEffect } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2, Upload, CheckCircle, XCircle, Link2, Search,
  FileSpreadsheet, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function BankReconciliation() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [statementLines, setStatementLines] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [unmatchedPayouts, setUnmatchedPayouts] = useState([]);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [searchPayout, setSearchPayout] = useState('');
  const [stats, setStats] = useState({
    totalLines: 0,
    matchedLines: 0,
    unmatchedLines: 0,
    totalAmount: 0,
    matchedAmount: 0
  });

  useEffect(() => {
    loadStatements();
    logFinanceAction('view_bank_reconciliation');
  }, []);

  useEffect(() => {
    if (selectedStatement) {
      loadStatementLines(selectedStatement);
    }
  }, [selectedStatement]);

  const loadStatements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .order('statement_date', { ascending: false });

      if (error) throw error;
      setStatements(data || []);

      if (data?.length > 0 && !selectedStatement) {
        setSelectedStatement(data[0].id);
      }
    } catch (error) {
      console.error('Error loading statements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatementLines = async (statementId) => {
    try {
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .select(`
          *,
          payouts:matched_payout_id (id, payout_reference, amount, organizer_id)
        `)
        .eq('statement_id', statementId)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setStatementLines(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const matched = data?.filter(l => l.is_matched).length || 0;
      const totalAmount = data?.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;
      const matchedAmount = data?.filter(l => l.is_matched).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0) || 0;

      setStats({
        totalLines: total,
        matchedLines: matched,
        unmatchedLines: total - matched,
        totalAmount,
        matchedAmount
      });
    } catch (error) {
      console.error('Error loading statement lines:', error);
    }
  };

  const loadUnmatchedPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
          *,
          organizers (business_name)
        `)
        .eq('status', 'completed')
        .is('bank_matched', null)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setUnmatchedPayouts(data || []);
    } catch (error) {
      console.error('Error loading payouts:', error);
    }
  };

  const handleUploadStatement = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create statement record
      const { data: statement, error: insertError } = await supabase
        .from('bank_statements')
        .insert({
          bank_name: 'Imported',
          statement_date: new Date().toISOString().split('T')[0],
          file_path: fileName
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Parse CSV and create lines
      const text = await file.text();
      const lines = text.split('\n').slice(1); // Skip header

      const lineRecords = lines
        .filter(line => line.trim())
        .map(line => {
          const [date, description, reference, amount, currency] = line.split(',');
          return {
            statement_id: statement.id,
            transaction_date: date?.trim(),
            description: description?.trim(),
            reference: reference?.trim(),
            amount: parseFloat(amount?.trim() || 0),
            currency: currency?.trim() || 'USD'
          };
        });

      if (lineRecords.length > 0) {
        await supabase.from('bank_statement_lines').insert(lineRecords);
      }

      logFinanceAction('upload_bank_statement', { statement_id: statement.id });
      loadStatements();
    } catch (error) {
      console.error('Error uploading statement:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleMatchLine = async (lineId, payoutId) => {
    try {
      // Update statement line
      await supabase
        .from('bank_statement_lines')
        .update({
          matched_payout_id: payoutId,
          is_matched: true
        })
        .eq('id', lineId);

      // Update payout
      await supabase
        .from('payouts')
        .update({ bank_matched: true })
        .eq('id', payoutId);

      logFinanceAction('match_bank_line', { line_id: lineId, payout_id: payoutId });
      loadStatementLines(selectedStatement);
      setMatchDialogOpen(false);
    } catch (error) {
      console.error('Error matching:', error);
    }
  };

  const handleUnmatch = async (lineId) => {
    try {
      const line = statementLines.find(l => l.id === lineId);

      // Update statement line
      await supabase
        .from('bank_statement_lines')
        .update({
          matched_payout_id: null,
          is_matched: false
        })
        .eq('id', lineId);

      // Update payout
      if (line?.matched_payout_id) {
        await supabase
          .from('payouts')
          .update({ bank_matched: null })
          .eq('id', line.matched_payout_id);
      }

      logFinanceAction('unmatch_bank_line', { line_id: lineId });
      loadStatementLines(selectedStatement);
    } catch (error) {
      console.error('Error unmatching:', error);
    }
  };

  const openMatchDialog = (line) => {
    setSelectedLine(line);
    loadUnmatchedPayouts();
    setMatchDialogOpen(true);
  };

  const filteredPayouts = unmatchedPayouts.filter(p =>
    p.payout_reference?.toLowerCase().includes(searchPayout.toLowerCase()) ||
    p.organizers?.business_name?.toLowerCase().includes(searchPayout.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-foreground">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Match payouts with bank transactions</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <Input
              type="file"
              accept=".csv"
              onChange={handleUploadStatement}
              className="hidden"
            />
            <Button variant="outline" className="rounded-xl" asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Statement
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Lines</p>
                <p className="text-2xl font-bold">{stats.totalLines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Matched</p>
                <p className="text-2xl font-bold">{stats.matchedLines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unmatched</p>
                <p className="text-2xl font-bold">{stats.unmatchedLines}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Match Rate</p>
                <p className="text-2xl font-bold">
                  {stats.totalLines > 0
                    ? ((stats.matchedLines / stats.totalLines) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statement Selector */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={selectedStatement || ''} onValueChange={setSelectedStatement}>
              <SelectTrigger className="w-[300px] rounded-xl">
                <SelectValue placeholder="Select Statement" />
              </SelectTrigger>
              <SelectContent>
                {statements.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.bank_name} - {new Date(s.statement_date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statement Lines */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Bank Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Matched Payout</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statementLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.transaction_date
                      ? new Date(line.transaction_date).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {line.description || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {line.reference || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(line.amount, line.currency)}
                  </TableCell>
                  <TableCell>
                    {line.is_matched ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Matched
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Unmatched
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {line.payouts ? (
                      <span className="text-sm font-mono">
                        {line.payouts.payout_reference}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {line.is_matched ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnmatch(line.id)}
                        className="rounded-lg"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMatchDialog(line)}
                        className="rounded-lg"
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {statementLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {selectedStatement
                      ? 'No transactions in this statement'
                      : 'Select a statement to view transactions'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Match Transaction to Payout</DialogTitle>
          </DialogHeader>
          {selectedLine && (
            <div className="space-y-4">
              <Card className="border rounded-xl bg-background">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Bank Description</p>
                      <p className="font-medium">{selectedLine.description}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">
                        {formatPrice(selectedLine.amount, selectedLine.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reference</p>
                      <p className="font-mono">{selectedLine.reference}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p>{new Date(selectedLine.transaction_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search payouts by reference or organizer..."
                  value={searchPayout}
                  onChange={(e) => setSearchPayout(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredPayouts.map((payout) => (
                  <Card
                    key={payout.id}
                    className="border rounded-xl hover:border-[#2969FF] cursor-pointer transition-colors"
                    onClick={() => handleMatchLine(selectedLine.id, payout.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{payout.organizers?.business_name}</p>
                          <p className="text-sm font-mono text-muted-foreground">
                            {payout.payout_reference}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {formatPrice(payout.amount, payout.currency)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payout.completed_at
                              ? new Date(payout.completed_at).toLocaleDateString()
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredPayouts.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    No matching payouts found
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
