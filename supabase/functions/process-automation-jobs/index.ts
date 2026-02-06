// Process Communication Automation Jobs
// This function runs on a schedule to process pending automation jobs

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const results = {
      processed: 0,
      completed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // ============================================================================
    // 1. PROCESS SCHEDULED JOBS (Event Reminders)
    // ============================================================================
    const { data: scheduledJobs, error: jobsError } = await supabase
      .from('communication_scheduled_jobs')
      .select(`
        *,
        automation:automation_id (
          id, organizer_id, actions, status
        ),
        event:event_id (
          id, title, start_date, venue_name, organizer_id,
          organizer:organizer_id (business_name)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(100);

    if (jobsError) {
      console.error('Error fetching scheduled jobs:', jobsError);
    }

    for (const job of scheduledJobs || []) {
      results.processed++;

      try {
        // Skip if automation is not active
        if (job.automation?.status !== 'active') {
          await supabase
            .from('communication_scheduled_jobs')
            .update({ status: 'cancelled', processed_at: now })
            .eq('id', job.id);
          continue;
        }

        // Build context for variable replacement
        const context = {
          ...job.job_data,
          event_name: job.event?.title,
          event_date: formatDate(job.event?.start_date),
          event_time: formatTime(job.event?.start_date),
          event_venue: job.event?.venue_name || 'TBA',
          organizer_name: job.event?.organizer?.business_name,
        };

        // Send messages for each action
        for (const action of job.automation?.actions || []) {
          const messageContent = replaceVariables(action.content, context);

          if (action.channel === 'email' && job.job_data?.attendee_email) {
            await sendEmail(supabase, {
              to: job.job_data.attendee_email,
              subject: messageContent.subject,
              body: messageContent.body,
              organizerId: job.organizer_id,
            });
          } else if (action.channel === 'sms' && job.job_data?.attendee_phone) {
            await sendSMS(supabase, {
              to: job.job_data.attendee_phone,
              message: messageContent.message,
              organizerId: job.organizer_id,
            });
          } else if (action.channel === 'whatsapp' && job.job_data?.attendee_phone) {
            await sendWhatsApp(supabase, {
              to: job.job_data.attendee_phone,
              message: messageContent.message,
              organizerId: job.organizer_id,
            });
          }
        }

        // Mark job as completed
        await supabase
          .from('communication_scheduled_jobs')
          .update({ status: 'completed', processed_at: now })
          .eq('id', job.id);

        // Update automation stats
        await supabase
          .from('communication_automations')
          .update({
            total_completed: supabase.rpc('increment_field', { field: 'total_completed' }),
            last_triggered_at: now,
          })
          .eq('id', job.automation_id);

        results.completed++;
      } catch (error) {
        console.error('Job processing error:', error);
        results.failed++;
        results.errors.push(`Job ${job.id}: ${error.message}`);

        await supabase
          .from('communication_scheduled_jobs')
          .update({ status: 'failed', error: error.message, processed_at: now })
          .eq('id', job.id);
      }
    }

    // ============================================================================
    // 2. PROCESS AUTOMATION RUNS (Multi-step Sequences)
    // ============================================================================
    const { data: automationRuns, error: runsError } = await supabase
      .from('communication_automation_runs')
      .select(`
        *,
        automation:automation_id (
          id, organizer_id, actions, status
        )
      `)
      .eq('status', 'running')
      .lte('next_action_at', now)
      .limit(50);

    if (runsError) {
      console.error('Error fetching automation runs:', runsError);
    }

    for (const run of automationRuns || []) {
      results.processed++;

      try {
        const automation = run.automation;
        const actions = automation?.actions || [];
        const currentIndex = run.current_action_index || 0;

        if (currentIndex >= actions.length) {
          // All actions completed
          await supabase
            .from('communication_automation_runs')
            .update({ status: 'completed', completed_at: now })
            .eq('id', run.id);
          
          await supabase
            .from('communication_automations')
            .update({ total_completed: supabase.rpc('increment_field', { field: 'total_completed' }) })
            .eq('id', automation.id);

          results.completed++;
          continue;
        }

        const action = actions[currentIndex];
        const context = run.context_data || {};
        const messageContent = replaceVariables(action.content, context);

        // Send the message
        let sendResult = { success: false, error: 'No valid recipient' };

        if (action.channel === 'email' && context.attendee_email) {
          sendResult = await sendEmail(supabase, {
            to: context.attendee_email,
            subject: messageContent.subject,
            body: messageContent.body,
            organizerId: automation.organizer_id,
          });
        } else if (action.channel === 'sms' && context.attendee_phone) {
          sendResult = await sendSMS(supabase, {
            to: context.attendee_phone,
            message: messageContent.message,
            organizerId: automation.organizer_id,
          });
        } else if (action.channel === 'whatsapp' && context.attendee_phone) {
          sendResult = await sendWhatsApp(supabase, {
            to: context.attendee_phone,
            message: messageContent.message,
            organizerId: automation.organizer_id,
          });
        }

        // Update action logs
        const actionLogs = run.action_logs || [];
        actionLogs.push({
          action_index: currentIndex,
          status: sendResult.success ? 'sent' : 'failed',
          sent_at: now,
          error: sendResult.error || null,
        });

        // Calculate next action time
        const nextIndex = currentIndex + 1;
        let nextActionAt = null;
        let newStatus = 'running';

        if (nextIndex < actions.length) {
          const nextAction = actions[nextIndex];
          const delayMinutes = nextAction.delay_minutes || 0;
          nextActionAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
        } else {
          newStatus = 'completed';
        }

        await supabase
          .from('communication_automation_runs')
          .update({
            current_action_index: nextIndex,
            action_logs: actionLogs,
            next_action_at: nextActionAt,
            status: newStatus,
            completed_at: newStatus === 'completed' ? now : null,
          })
          .eq('id', run.id);

        if (newStatus === 'completed') results.completed++;
      } catch (error) {
        console.error('Automation run error:', error);
        results.failed++;
        results.errors.push(`Run ${run.id}: ${error.message}`);

        await supabase
          .from('communication_automation_runs')
          .update({ status: 'failed', failure_reason: error.message, failed_at: now })
          .eq('id', run.id);
      }
    }

    // ============================================================================
    // 3. EXPIRE OLD CREDITS
    // ============================================================================
    const { data: expiredCredits } = await supabase
      .from('communication_credit_expiry')
      .select('id, organizer_id, is_bonus, remaining_amount')
      .eq('expired', false)
      .gt('remaining_amount', 0)
      .lte('expires_at', now);

    for (const expiry of expiredCredits || []) {
      try {
        // Deduct from balance
        const balanceField = expiry.is_bonus ? 'bonus_balance' : 'balance';
        await supabase.rpc('deduct_expired_credits', {
          p_organizer_id: expiry.organizer_id,
          p_amount: expiry.remaining_amount,
          p_is_bonus: expiry.is_bonus,
        });

        // Mark as expired
        await supabase
          .from('communication_credit_expiry')
          .update({ expired: true, expired_at: now, remaining_amount: 0 })
          .eq('id', expiry.id);
      } catch (error) {
        console.error('Credit expiry error:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function replaceVariables(content: any, context: any): any {
  if (typeof content === 'string') {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = context[key.trim()];
      return value !== undefined ? value : match;
    });
  }
  
  if (typeof content === 'object' && content !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(content)) {
      result[key] = replaceVariables(value, context);
    }
    return result;
  }
  
  return content;
}

async function sendEmail(supabase: any, params: {
  to: string;
  subject: string;
  body: string;
  organizerId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'bulk_campaign',
        to: params.to,
        data: {
          subject: params.subject,
          title: params.subject,
          body: params.body,
        },
        organizerId: params.organizerId,
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

async function sendSMS(supabase: any, params: {
  to: string;
  message: string;
  organizerId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check credits first
    const { data: balance } = await supabase
      .from('communication_credit_balances')
      .select('balance, bonus_balance')
      .eq('organizer_id', params.organizerId)
      .single();

    const totalBalance = (balance?.balance || 0) + (balance?.bonus_balance || 0);
    const smsCredits = 5; // SMS cost

    if (totalBalance < smsCredits) {
      return { success: false, error: 'Insufficient credits' };
    }

    // Deduct credits
    await supabase.rpc('deduct_communication_credits', {
      p_organizer_id: params.organizerId,
      p_amount: smsCredits,
      p_channel: 'sms',
      p_message_count: 1,
    });

    // Send via SMS function
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        organizer_id: params.organizerId,
        audience_type: 'custom',
        recipients: [{ phone: params.to, name: 'Recipient' }],
        message: params.message,
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: error.message };
  }
}

async function sendWhatsApp(supabase: any, params: {
  to: string;
  message: string;
  organizerId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check credits first
    const { data: balance } = await supabase
      .from('communication_credit_balances')
      .select('balance, bonus_balance')
      .eq('organizer_id', params.organizerId)
      .single();

    const totalBalance = (balance?.balance || 0) + (balance?.bonus_balance || 0);
    const waCredits = 20; // WhatsApp utility cost

    if (totalBalance < waCredits) {
      return { success: false, error: 'Insufficient credits' };
    }

    // Deduct credits
    await supabase.rpc('deduct_communication_credits', {
      p_organizer_id: params.organizerId,
      p_amount: waCredits,
      p_channel: 'whatsapp_utility',
      p_message_count: 1,
    });

    // Send via WhatsApp function
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        to: params.to,
        message: params.message,
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error.message };
  }
}
