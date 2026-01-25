// Process Drip Campaign Steps
// Executes pending drip campaign steps (sends emails, SMS, etc.)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    console.log('Processing drip campaign steps...');

    // Get pending steps to execute
    const { data: pendingSteps, error: fetchError } = await supabase
      .rpc('get_pending_drip_steps', { p_limit: 50 });

    if (fetchError) {
      console.error('Error fetching pending steps:', fetchError);
      throw fetchError;
    }

    if (!pendingSteps || pendingSteps.length === 0) {
      console.log('No pending drip steps to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending steps', ...results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingSteps.length} pending drip steps`);

    // Process each step
    for (const step of pendingSteps) {
      try {
        results.processed++;
        
        // Get contact details
        const { data: contact } = await supabase
          .from('contacts')
          .select('email, phone, full_name, email_opt_in, sms_opt_in, whatsapp_opt_in')
          .eq('id', step.contact_id)
          .single();

        if (!contact) {
          console.log(`Contact not found: ${step.contact_id}`);
          await advanceEnrollment(supabase, step.enrollment_id, 'skipped');
          continue;
        }

        // Execute based on action type
        let executionResult = 'sent';
        
        switch (step.action_type) {
          case 'send_email':
            if (!contact.email || !contact.email_opt_in) {
              executionResult = 'skipped';
              break;
            }
            
            const emailConfig = step.action_config;
            const emailResult = await supabase.functions.invoke('send-email', {
              body: {
                type: 'bulk_campaign',
                to: contact.email,
                data: {
                  subject: replaceVariables(emailConfig.subject, contact),
                  body: replaceVariables(emailConfig.body, contact),
                  title: emailConfig.subject,
                },
                campaignId: step.campaign_id,
                enableTracking: true,
              }
            });
            
            if (emailResult.error) {
              executionResult = 'failed';
              results.failed++;
            } else {
              results.sent++;
            }
            break;

          case 'send_sms':
            if (!contact.phone || !contact.sms_opt_in) {
              executionResult = 'skipped';
              break;
            }
            
            const smsConfig = step.action_config;
            const smsResult = await supabase.functions.invoke('send-sms', {
              body: {
                to: contact.phone,
                message: replaceVariables(smsConfig.message, contact),
                organizer_id: step.organizer_id,
              }
            });
            
            if (smsResult.error) {
              executionResult = 'failed';
              results.failed++;
            } else {
              results.sent++;
            }
            break;

          case 'send_whatsapp':
            if (!contact.phone || !contact.whatsapp_opt_in) {
              executionResult = 'skipped';
              break;
            }
            
            const waConfig = step.action_config;
            const waResult = await supabase.functions.invoke('send-whatsapp', {
              body: {
                to: contact.phone,
                message: replaceVariables(waConfig.message, contact),
                type: 'text',
                organizer_id: step.organizer_id,
              }
            });
            
            if (waResult.error) {
              executionResult = 'failed';
              results.failed++;
            } else {
              results.sent++;
            }
            break;

          case 'add_tag':
            const tagToAdd = step.action_config.tag;
            if (tagToAdd) {
              await supabase
                .from('contacts')
                .update({ 
                  tags: supabase.sql`array_append(tags, ${tagToAdd})` 
                })
                .eq('id', step.contact_id);
            }
            results.sent++;
            break;

          case 'remove_tag':
            const tagToRemove = step.action_config.tag;
            if (tagToRemove) {
              await supabase
                .from('contacts')
                .update({ 
                  tags: supabase.sql`array_remove(tags, ${tagToRemove})` 
                })
                .eq('id', step.contact_id);
            }
            results.sent++;
            break;

          case 'webhook':
            const webhookUrl = step.action_config.url;
            if (webhookUrl) {
              try {
                await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contact_id: step.contact_id,
                    contact_email: contact.email,
                    contact_phone: contact.phone,
                    campaign_id: step.campaign_id,
                    step_id: step.step_id,
                    ...step.action_config.payload,
                  }),
                });
                results.sent++;
              } catch (e) {
                executionResult = 'failed';
                results.failed++;
              }
            }
            break;

          default:
            console.log(`Unknown action type: ${step.action_type}`);
            executionResult = 'skipped';
        }

        // Advance to next step
        await advanceEnrollment(supabase, step.enrollment_id, executionResult);

      } catch (stepError) {
        console.error(`Error processing step ${step.step_id}:`, stepError);
        results.errors.push(`Step ${step.step_id}: ${stepError.message}`);
        results.failed++;
        
        // Still try to advance (mark as failed)
        await advanceEnrollment(supabase, step.enrollment_id, 'failed');
      }
    }

    console.log(`Drip processing complete:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Drip campaign processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, ...results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function advanceEnrollment(supabase: any, enrollmentId: string, status: string): Promise<void> {
  await supabase.rpc('advance_drip_enrollment', {
    p_enrollment_id: enrollmentId,
    p_execution_status: status,
  });
}

function replaceVariables(text: string, contact: any): string {
  if (!text) return '';
  
  return text
    .replace(/\{\{first_name\}\}/gi, contact.full_name?.split(' ')[0] || 'there')
    .replace(/\{\{full_name\}\}/gi, contact.full_name || 'there')
    .replace(/\{\{name\}\}/gi, contact.full_name?.split(' ')[0] || 'there')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '');
}
