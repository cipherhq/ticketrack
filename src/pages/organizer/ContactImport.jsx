import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle,
  Loader2, Download, ArrowLeft, Users, Mail, Phone, Tag,
  Eye, Trash2, RefreshCw, ChevronRight, Info, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// Required and optional fields
const FIELD_MAPPINGS = [
  { key: 'email', label: 'Email Address', required: false, type: 'email' },
  { key: 'phone', label: 'Phone Number', required: false, type: 'phone' },
  { key: 'full_name', label: 'Full Name', required: false, type: 'text' },
  { key: 'first_name', label: 'First Name', required: false, type: 'text' },
  { key: 'last_name', label: 'Last Name', required: false, type: 'text' },
  { key: 'tags', label: 'Tags (comma-separated)', required: false, type: 'tags' },
];

export function ContactImport() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();

  // Step state
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Fields, 3: Preview, 4: Import, 5: Complete

  // File state
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [headers, setHeaders] = useState([]);

  // Mapping state
  const [fieldMappings, setFieldMappings] = useState({});

  // Preview state
  const [previewData, setPreviewData] = useState([]);
  const [validRows, setValidRows] = useState(0);
  const [invalidRows, setInvalidRows] = useState([]);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);

  // Options
  const [options, setOptions] = useState({
    skipDuplicates: true,
    emailOptIn: true,
    smsOptIn: false,
    whatsappOptIn: false,
    defaultTags: [],
  });

  // Consent
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const parseFile = async (file) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      alert('File must contain at least a header row and one data row');
      return;
    }

    // Parse CSV (handling quoted values)
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const parsedHeaders = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    const parsedData = lines.slice(1).map(line => parseCSVLine(line));

    setHeaders(parsedHeaders);
    setFileData(parsedData);

    // Auto-map fields based on header names
    const autoMappings = {};
    parsedHeaders.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('email')) autoMappings.email = index;
      else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) autoMappings.phone = index;
      else if (lowerHeader === 'name' || lowerHeader === 'full name' || lowerHeader === 'fullname') autoMappings.full_name = index;
      else if (lowerHeader === 'first name' || lowerHeader === 'firstname') autoMappings.first_name = index;
      else if (lowerHeader === 'last name' || lowerHeader === 'lastname' || lowerHeader === 'surname') autoMappings.last_name = index;
      else if (lowerHeader.includes('tag')) autoMappings.tags = index;
    });
    setFieldMappings(autoMappings);

    setStep(2);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect({ target: { files: [droppedFile] } });
    }
  }, []);

  // ============================================================================
  // FIELD MAPPING
  // ============================================================================

  const updateMapping = (field, columnIndex) => {
    setFieldMappings(prev => ({
      ...prev,
      [field]: columnIndex === 'none' ? undefined : parseInt(columnIndex),
    }));
  };

  const canProceedToPreview = () => {
    // Must have at least email or phone mapped
    return fieldMappings.email !== undefined || fieldMappings.phone !== undefined;
  };

  // ============================================================================
  // PREVIEW & VALIDATION
  // ============================================================================

  const generatePreview = () => {
    const preview = [];
    const invalid = [];

    fileData.forEach((row, index) => {
      const contact = {};
      let isValid = true;
      const errors = [];

      // Map fields
      Object.entries(fieldMappings).forEach(([field, colIndex]) => {
        if (colIndex !== undefined && row[colIndex]) {
          contact[field] = row[colIndex].replace(/"/g, '').trim();
        }
      });

      // Build full name if only first/last provided
      if (!contact.full_name && (contact.first_name || contact.last_name)) {
        contact.full_name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
      }

      // Validate email
      if (contact.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.email)) {
          errors.push('Invalid email format');
          isValid = false;
        }
      }

      // Validate phone
      if (contact.phone) {
        const cleanPhone = contact.phone.replace(/[\s\-\(\)]/g, '');
        if (cleanPhone.length < 10) {
          errors.push('Phone number too short');
          isValid = false;
        }
        contact.phone = cleanPhone;
      }

      // Must have email or phone
      if (!contact.email && !contact.phone) {
        errors.push('Must have email or phone');
        isValid = false;
      }

      // Parse tags
      if (contact.tags) {
        contact.tags = contact.tags.split(',').map(t => t.trim()).filter(Boolean);
      } else {
        contact.tags = [];
      }

      // Add default tags
      if (options.defaultTags.length > 0) {
        contact.tags = [...new Set([...contact.tags, ...options.defaultTags])];
      }

      if (isValid) {
        preview.push(contact);
      } else {
        invalid.push({ row: index + 2, data: row, errors }); // +2 for 1-indexed + header row
      }
    });

    setPreviewData(preview);
    setValidRows(preview.length);
    setInvalidRows(invalid);
    setStep(3);
  };

  // ============================================================================
  // IMPORT
  // ============================================================================

  const startImport = async () => {
    if (!consentConfirmed) {
      alert('Please confirm consent before importing');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setStep(4);

    const results = {
      total: previewData.length,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const batchSize = 50;
    const batches = [];

    // Create batches
    for (let i = 0; i < previewData.length; i += batchSize) {
      batches.push(previewData.slice(i, i + batchSize));
    }

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const contactsToInsert = batch.map(contact => ({
          organizer_id: organizer.id,
          email: contact.email || null,
          phone: contact.phone || null,
          full_name: contact.full_name || null,
          source_type: 'imported',
          source_metadata: { import_file: file.name, import_date: new Date().toISOString() },
          email_opt_in: options.emailOptIn,
          sms_opt_in: options.smsOptIn,
          whatsapp_opt_in: options.whatsappOptIn,
          tags: contact.tags,
          first_contact_at: new Date().toISOString(),
          last_contact_at: new Date().toISOString(),
        }));

        // Use upsert if skipping duplicates
        if (options.skipDuplicates) {
          const { data, error } = await supabase
            .from('contacts')
            .upsert(contactsToInsert, {
              onConflict: 'organizer_id,email',
              ignoreDuplicates: true,
            });

          if (error) throw error;
          results.imported += batch.length;
        } else {
          const { data, error } = await supabase
            .from('contacts')
            .insert(contactsToInsert);

          if (error) {
            if (error.code === '23505') { // Unique violation
              results.skipped += batch.length;
            } else {
              throw error;
            }
          } else {
            results.imported += batch.length;
          }
        }
      } catch (error) {
        console.error('Batch import error:', error);
        results.errors.push({ batch: i + 1, error: error.message });
      }

      setImportProgress(((i + 1) / batches.length) * 100);
    }

    setImportResults(results);
    setImporting(false);
    setStep(5);
  };

  // ============================================================================
  // DOWNLOAD TEMPLATE
  // ============================================================================

  const downloadTemplate = () => {
    const headers = ['Email', 'Phone', 'Full Name', 'Tags'];
    const sampleRows = [
      ['john@example.com', '+2348012345678', 'John Doe', 'VIP, Newsletter'],
      ['jane@example.com', '+2348087654321', 'Jane Smith', 'Newsletter'],
    ];

    const csv = [headers, ...sampleRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contact-import-template.csv';
    a.click();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/organizer/contacts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Contacts</h1>
          <p className="text-muted-foreground">Upload a CSV file to import contacts</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {['Upload', 'Map Fields', 'Preview', 'Import', 'Complete'].map((label, index) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > index + 1 ? 'bg-green-500 text-white' :
              step === index + 1 ? 'bg-[#2969FF] text-white' :
              'bg-muted text-muted-foreground'
            }`}>
              {step > index + 1 ? <CheckCircle className="w-4 h-4" /> : index + 1}
            </div>
            <span className={`ml-2 text-sm ${step === index + 1 ? 'font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {index < 4 && <ChevronRight className="w-4 h-4 mx-4 text-foreground/20" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-border/20 rounded-xl p-12 text-center hover:border-[#2969FF] transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
              <p className="text-muted-foreground mb-4">or click to browse</p>
              <Button variant="outline">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Select File
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="ghost" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">File Requirements:</p>
                  <ul className="list-disc list-inside text-blue-700 space-y-1">
                    <li>CSV format with headers in the first row</li>
                    <li>Must include Email or Phone column</li>
                    <li>Maximum 10,000 rows per import</li>
                    <li>UTF-8 encoding recommended</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Fields */}
      {step === 2 && (
        <Card className="border-border/10 rounded-xl">
          <CardHeader>
            <CardTitle>Map Your Columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground mb-4">
              Match your CSV columns to the contact fields. We've auto-detected some mappings.
            </p>

            <div className="grid gap-4">
              {FIELD_MAPPINGS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <Label className="w-40 flex-shrink-0">
                    {field.label}
                    {field.key === 'email' || field.key === 'phone' ? (
                      <span className="text-red-500 ml-1">*</span>
                    ) : null}
                  </Label>
                  <Select
                    value={fieldMappings[field.key]?.toString() ?? 'none'}
                    onValueChange={(v) => updateMapping(field.key, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Don't import --</SelectItem>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {header} (Column {index + 1})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="p-4 bg-amber-50 rounded-xl mt-6">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">
                  You must map at least Email or Phone to proceed
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => { setStep(1); setFile(null); }}>
                Back
              </Button>
              <Button
                onClick={generatePreview}
                disabled={!canProceedToPreview()}
                className="bg-[#2969FF] text-white"
              >
                Continue to Preview
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border/10 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{fileData.length}</p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{validRows}</p>
                    <p className="text-xs text-muted-foreground">Valid Contacts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                    <p className="text-xs text-muted-foreground">Invalid Rows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Table */}
          <Card className="border-border/10 rounded-xl">
            <CardHeader>
              <CardTitle>Preview (First 10 contacts)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0F0F0F]/5">
                    {previewData.slice(0, 10).map((contact, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">{contact.email || '-'}</td>
                        <td className="px-4 py-2 text-sm">{contact.phone || '-'}</td>
                        <td className="px-4 py-2 text-sm">{contact.full_name || '-'}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(contact.tags || []).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Import Options */}
          <Card className="border-border/10 rounded-xl">
            <CardHeader>
              <CardTitle>Import Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={options.skipDuplicates}
                  onCheckedChange={(checked) => setOptions(o => ({ ...o, skipDuplicates: checked }))}
                />
                <Label>Skip duplicate contacts (by email)</Label>
              </div>

              <div className="border-t border-border/10 pt-4">
                <p className="text-sm font-medium mb-3">Default Opt-in Settings</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={options.emailOptIn}
                      onCheckedChange={(checked) => setOptions(o => ({ ...o, emailOptIn: checked }))}
                    />
                    <Label className="text-sm">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={options.smsOptIn}
                      onCheckedChange={(checked) => setOptions(o => ({ ...o, smsOptIn: checked }))}
                    />
                    <Label className="text-sm">SMS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={options.whatsappOptIn}
                      onCheckedChange={(checked) => setOptions(o => ({ ...o, whatsappOptIn: checked }))}
                    />
                    <Label className="text-sm">WhatsApp</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consent Confirmation */}
          <Card className="border-amber-200 bg-amber-50 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={consentConfirmed}
                  onCheckedChange={setConsentConfirmed}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-amber-800">Consent Confirmation</p>
                  <p className="text-sm text-amber-700">
                    I confirm that all contacts in this file have given valid consent to receive 
                    marketing communications from me. I understand that I am responsible for 
                    compliance with NDPR and other applicable data protection laws.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={startImport}
              disabled={!consentConfirmed || validRows === 0}
              className="bg-[#2969FF] text-white"
            >
              Import {validRows} Contacts
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 4 && (
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-16 h-16 animate-spin text-[#2969FF] mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Importing Contacts...</h2>
            <p className="text-muted-foreground mb-6">Please don't close this page</p>
            <Progress value={importProgress} className="w-full max-w-md mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">{Math.round(importProgress)}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Complete */}
      {step === 5 && importResults && (
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Import Complete!</h2>
            
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto my-6">
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{importResults.imported}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-bold text-yellow-600">{importResults.skipped}</p>
                <p className="text-xs text-yellow-600">Skipped</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl">
                <p className="text-2xl font-bold text-red-600">{importResults.errors.length}</p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/organizer/contacts')}>
                <Users className="w-4 h-4 mr-2" />
                View Contacts
              </Button>
              <Button onClick={() => navigate('/organizer/hub')} className="bg-[#2969FF] text-white">
                <Mail className="w-4 h-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ContactImport;
