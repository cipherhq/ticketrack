import { useState, useEffect } from 'react';
import { Mail, Save, Eye, RotateCcw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

const defaultTemplates = {
  purchaseCustomer: {
    subject: 'Your Ticket for {{EVENT_NAME}}',
    body: `Hi {{CUSTOMER_NAME}},

Thank you for purchasing tickets to {{EVENT_NAME}}!

Event Details:
- Event: {{EVENT_NAME}}
- Date: {{EVENT_DATE}}
- Location: {{EVENT_LOCATION}}
- Tickets: {{TICKET_QUANTITY}}

Your tickets are attached to this email and also available in your Ticketrack account.

Order Summary:
Amount Paid: {{AMOUNT_PAID}}
Order ID: {{ORDER_ID}}

See you at the event!

Best regards,
The Ticketrack Team`,
  },
  purchaseOrganizer: {
    subject: 'New Ticket Purchase for {{EVENT_NAME}}',
    body: `Hi {{ORGANIZER_NAME}},

You have a new ticket purchase for {{EVENT_NAME}}!

Purchase Details:
- Customer: {{CUSTOMER_NAME}}
- Email: {{CUSTOMER_EMAIL}}
- Tickets: {{TICKET_QUANTITY}}
- Amount: {{AMOUNT_PAID}}
- Order ID: {{ORDER_ID}}

You can view all purchases in your organizer dashboard.

Best regards,
The Ticketrack Team`,
  },
  refund: {
    subject: 'Refund Processed for {{EVENT_NAME}}',
    body: `Hi {{CUSTOMER_NAME}},

Your refund for {{EVENT_NAME}} has been processed.

Refund Details:
- Event: {{EVENT_NAME}}
- Refund Amount: {{REFUND_AMOUNT}}
- Refund ID: {{REFUND_ID}}
- Processing Time: 5-7 business days

The refund will be credited back to your original payment method.

If you have any questions, please contact our support team.

Best regards,
The Ticketrack Team`,
  },
};

const availableVariables = {
  purchaseCustomer: ['CUSTOMER_NAME', 'EVENT_NAME', 'EVENT_DATE', 'EVENT_LOCATION', 'TICKET_QUANTITY', 'AMOUNT_PAID', 'ORDER_ID'],
  purchaseOrganizer: ['ORGANIZER_NAME', 'EVENT_NAME', 'CUSTOMER_NAME', 'CUSTOMER_EMAIL', 'TICKET_QUANTITY', 'AMOUNT_PAID', 'ORDER_ID'],
  refund: ['CUSTOMER_NAME', 'EVENT_NAME', 'REFUND_AMOUNT', 'REFUND_ID'],
};

export function AdminEmailTemplates() {
  const { logAdminAction } = useAdmin();
  const [selectedTemplate, setSelectedTemplate] = useState('purchaseCustomer');
  const [templates, setTemplates] = useState(defaultTemplates);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .like('key', 'email_template_%');

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedTemplates = { ...defaultTemplates };
        data.forEach((setting) => {
          const templateKey = setting.key.replace('email_template_', '');
          if (loadedTemplates[templateKey]) {
            loadedTemplates[templateKey] = setting.value;
          }
        });
        setTemplates(loadedTemplates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentTemplate = templates[selectedTemplate];

  const updateTemplate = (field, value) => {
    setTemplates({
      ...templates,
      [selectedTemplate]: {
        ...currentTemplate,
        [field]: value,
      },
    });
  };

  const resetTemplate = () => {
    setTemplates({
      ...templates,
      [selectedTemplate]: defaultTemplates[selectedTemplate],
    });
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: `email_template_${selectedTemplate}`,
          value: currentTemplate,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      await logAdminAction('email_template_updated', 'platform_settings', null, { template: selectedTemplate });
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBefore = currentTemplate.body.substring(0, cursorPos);
      const textAfter = currentTemplate.body.substring(cursorPos);
      updateTemplate('body', `${textBefore}{{${variable}}}${textAfter}`);
    }
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
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Email Templates</h2>
        <p className="text-muted-foreground mt-1">Customize email templates sent to users</p>
      </div>

      <Tabs value={selectedTemplate} onValueChange={setSelectedTemplate}>
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="purchaseCustomer" className="rounded-lg">
            Purchase (Customer)
          </TabsTrigger>
          <TabsTrigger value="purchaseOrganizer" className="rounded-lg">
            Purchase (Organizer)
          </TabsTrigger>
          <TabsTrigger value="refund" className="rounded-lg">
            Refund
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTemplate} className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Editor */}
            <div className="lg:col-span-2">
              <Card className="border-border/10 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-foreground">Template Editor</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                      className="rounded-xl border-border/10"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {showPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetTemplate}
                      className="rounded-xl border-border/10"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={currentTemplate.subject}
                      onChange={(e) => updateTemplate('subject', e.target.value)}
                      className="rounded-xl border-border/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body">Email Body</Label>
                    <Textarea
                      id="body"
                      value={currentTemplate.body}
                      onChange={(e) => updateTemplate('body', e.target.value)}
                      className="rounded-xl border-border/10 min-h-[400px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={saveTemplate}
                      disabled={saving}
                      className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex-1"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              {showPreview && (
                <Card className="border-border/10 rounded-2xl mt-6">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-border/10 rounded-xl p-6 bg-card">
                      <div className="border-b border-border/10 pb-4 mb-4">
                        <p className="text-sm text-muted-foreground mb-1">Subject:</p>
                        <p className="text-foreground">{currentTemplate.subject}</p>
                      </div>
                      <div className="whitespace-pre-wrap text-foreground">
                        {currentTemplate.body}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Variables Sidebar */}
            <div className="space-y-6">
              <Card className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground">Available Variables</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Click to insert a variable into your template
                  </p>
                  {availableVariables[selectedTemplate]?.map((variable) => (
                    <Button
                      key={variable}
                      variant="outline"
                      onClick={() => insertVariable(variable)}
                      className="w-full justify-start rounded-xl border-border/10 hover:border-[#2969FF] hover:text-[#2969FF] font-mono text-sm"
                    >
                      {`{{${variable}}}`}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/10 rounded-2xl bg-[#2969FF]/5">
                <CardContent className="p-4">
                  <h4 className="text-foreground font-medium mb-2">Template Tips</h4>
                  <ul className="space-y-2 text-sm text-foreground/80">
                    <li>• Use variables in double curly braces</li>
                    <li>• Keep subject lines under 60 characters</li>
                    <li>• Test your templates before saving</li>
                    <li>• Personalize with customer names</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground">Template Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge className="bg-green-500 text-white rounded-lg">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
