import { supabase } from './supabase';
import { otpService } from './otpService';

class PayoutSecurityService {
  constructor() {
    this.authorizedRoles = ['super_admin', 'finance_admin', 'account_admin'];
    this.dualAuthRequired = 10000; // Amount threshold requiring dual authorization
    this.delayRequired = 50000; // Amount threshold requiring time delay
    this.maxDailyAmount = 1000000; // Maximum daily payout amount per user
  }

  /**
   * Check if user can initiate payouts
   * @param {string} userId - User ID
   * @returns {Promise<{canPayout: boolean, reason?: string}>}
   */
  async canInitiatePayouts(userId) {
    try {
      // Check user role
      const hasRole = await this.hasAuthorizedRole(userId);
      if (!hasRole.authorized) {
        return {
          canPayout: false,
          reason: 'User does not have authorization to process payouts'
        };
      }

      // Check if account is active and not suspended
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, account_status')
        .eq('id', userId)
        .single();

      if (!profile || !profile.is_active || profile.account_status === 'suspended') {
        return {
          canPayout: false,
          reason: 'Account is inactive or suspended'
        };
      }

      // Check active session
      const hasValidSession = await this.hasValidSession(userId);
      if (!hasValidSession) {
        return {
          canPayout: false,
          reason: 'No valid authenticated session'
        };
      }

      // Check daily limits
      const withinLimits = await this.checkDailyLimits(userId);
      if (!withinLimits.withinLimits) {
        return {
          canPayout: false,
          reason: `Daily payout limit exceeded: $${withinLimits.dailyAmount}`
        };
      }

      return {
        canPayout: true,
        role: hasRole.role,
        dailyRemaining: this.maxDailyAmount - withinLimits.dailyAmount
      };

    } catch (error) {
      console.error('Payout Authorization Check Error:', error);
      return {
        canPayout: false,
        reason: 'Authorization check failed'
      };
    }
  }

  /**
   * Process payout with security checks
   * @param {Object} payoutData - Payout information
   * @param {string} initiatedBy - User ID initiating payout
   * @returns {Promise<{success: boolean, payoutId?: string, requiresApproval?: boolean}>}
   */
  async processSecurePayout(payoutData, initiatedBy) {
    try {
      // Validate payout initiation
      const canPayout = await this.canInitiatePayouts(initiatedBy);
      if (!canPayout.canPayout) {
        throw new Error(canPayout.reason);
      }

      // Log payout attempt
      await this.logSecurityEvent(initiatedBy, 'payout_initiated', {
        amount: payoutData.amount,
        currency: payoutData.currency,
        recipient: payoutData.organizerId,
        method: payoutData.method
      });

      // Check if dual authorization is required
      const requiresDualAuth = payoutData.amount >= this.dualAuthRequired;
      
      // Check if time delay is required
      const requiresDelay = payoutData.amount >= this.delayRequired;

      // Verify OTP for all payouts
      if (!payoutData.otpVerified) {
        throw new Error('OTP verification required for payout processing');
      }

      // Create sensitive action log
      const { data: actionLog, error: actionError } = await supabase
        .from('sensitive_actions_log')
        .insert({
          user_id: initiatedBy,
          action_type: 'process_payout',
          resource_type: 'payout',
          amount_involved: payoutData.amount,
          currency: payoutData.currency,
          requires_approval: requiresDualAuth,
          otp_verified: payoutData.otpVerified,
          metadata: {
            organizerId: payoutData.organizerId,
            paymentMethod: payoutData.method,
            requiresDelay,
            scheduledFor: requiresDelay ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
          },
          status: requiresDualAuth ? 'pending_approval' : (requiresDelay ? 'scheduled' : 'processing')
        })
        .select()
        .single();

      if (actionError) throw actionError;

      // If dual authorization required, don't process immediately
      if (requiresDualAuth) {
        // Notify other authorized users for approval
        await this.notifyForApproval(actionLog.id, payoutData);
        
        return {
          success: true,
          payoutId: actionLog.id,
          requiresApproval: true,
          message: `Payout of ${payoutData.amount} ${payoutData.currency} requires dual authorization. Approval request sent.`
        };
      }

      // If time delay required, schedule for later
      if (requiresDelay) {
        await this.schedulePayout(actionLog.id, payoutData);
        
        return {
          success: true,
          payoutId: actionLog.id,
          requiresApproval: false,
          scheduled: true,
          message: `Payout of ${payoutData.amount} ${payoutData.currency} scheduled for processing in 24 hours.`
        };
      }

      // Process immediately for smaller amounts
      const payoutResult = await this.executePayout(payoutData, actionLog.id);
      
      // Update action log
      await supabase
        .from('sensitive_actions_log')
        .update({
          status: payoutResult.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            ...actionLog.metadata,
            payoutReference: payoutResult.reference,
            error: payoutResult.error
          }
        })
        .eq('id', actionLog.id);

      return {
        success: payoutResult.success,
        payoutId: actionLog.id,
        reference: payoutResult.reference,
        message: payoutResult.success ? 'Payout processed successfully' : payoutResult.error
      };

    } catch (error) {
      console.error('Secure Payout Error:', error);
      
      // Log failed payout attempt
      await this.logSecurityEvent(initiatedBy, 'payout_failed', {
        amount: payoutData.amount,
        error: error.message
      }, 'high');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Approve pending payout (dual authorization)
   * @param {string} actionId - Sensitive action ID
   * @param {string} approvedBy - User ID approving
   * @param {string} otpCode - OTP verification
   * @returns {Promise<{success: boolean}>}
   */
  async approvePayout(actionId, approvedBy, otpCode) {
    try {
      // Verify OTP
      const otpResult = await otpService.verifyOTP(approvedBy, otpCode, 'payout_approval');
      if (!otpResult.success) {
        throw new Error('OTP verification failed');
      }

      // Check if user can approve
      const canApprove = await this.canApprovePayout(approvedBy, actionId);
      if (!canApprove.canApprove) {
        throw new Error(canApprove.reason);
      }

      // Get payout details
      const { data: actionLog } = await supabase
        .from('sensitive_actions_log')
        .select('*')
        .eq('id', actionId)
        .eq('status', 'pending_approval')
        .single();

      if (!actionLog) {
        throw new Error('Payout not found or not pending approval');
      }

      // Update approval
      await supabase
        .from('sensitive_actions_log')
        .update({
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          status: 'processing'
        })
        .eq('id', actionId);

      // Execute payout
      const payoutData = {
        amount: actionLog.amount_involved,
        currency: actionLog.currency,
        organizerId: actionLog.metadata.organizerId,
        method: actionLog.metadata.paymentMethod
      };

      const payoutResult = await this.executePayout(payoutData, actionId);

      // Update final status
      await supabase
        .from('sensitive_actions_log')
        .update({
          status: payoutResult.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            ...actionLog.metadata,
            payoutReference: payoutResult.reference,
            error: payoutResult.error
          }
        })
        .eq('id', actionId);

      // Log approval
      await this.logSecurityEvent(approvedBy, 'payout_approved', {
        actionId,
        amount: actionLog.amount_involved,
        originalInitiator: actionLog.user_id
      });

      return {
        success: payoutResult.success,
        reference: payoutResult.reference,
        message: payoutResult.success ? 'Payout approved and processed' : payoutResult.error
      };

    } catch (error) {
      console.error('Payout Approval Error:', error);
      
      // Log failed approval
      await this.logSecurityEvent(approvedBy, 'payout_approval_failed', {
        actionId,
        error: error.message
      }, 'high');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user has authorized role for payouts
   */
  async hasAuthorizedRole(userId) {
    try {
      const { data: roleAssignment } = await supabase
        .from('user_role_assignments')
        .select(`
          *,
          role:user_roles(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .single();

      if (!roleAssignment || !roleAssignment.role) {
        return { authorized: false, reason: 'No active role found' };
      }

      const hasPayoutPermission = this.authorizedRoles.includes(roleAssignment.role.name) ||
                                  roleAssignment.role.can_process_payouts;

      return {
        authorized: hasPayoutPermission,
        role: roleAssignment.role,
        reason: hasPayoutPermission ? null : 'Role does not have payout permissions'
      };

    } catch (error) {
      console.error('Role Check Error:', error);
      return { authorized: false, reason: 'Role verification failed' };
    }
  }

  /**
   * Check daily payout limits
   */
  async checkDailyLimits(userId) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: todayPayouts } = await supabase
        .from('sensitive_actions_log')
        .select('amount_involved')
        .eq('user_id', userId)
        .eq('action_type', 'process_payout')
        .in('status', ['completed', 'processing', 'scheduled'])
        .gte('created_at', startOfDay.toISOString());

      const dailyAmount = todayPayouts?.reduce((sum, payout) => sum + (payout.amount_involved || 0), 0) || 0;

      return {
        withinLimits: dailyAmount < this.maxDailyAmount,
        dailyAmount,
        maxDaily: this.maxDailyAmount
      };

    } catch (error) {
      console.error('Daily Limit Check Error:', error);
      return { withinLimits: false, dailyAmount: this.maxDailyAmount };
    }
  }

  /**
   * Check if user has valid session
   */
  async hasValidSession(userId) {
    try {
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      return activeSessions && activeSessions.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can approve a specific payout
   */
  async canApprovePayout(userId, actionId) {
    try {
      // Get original payout initiator
      const { data: actionLog } = await supabase
        .from('sensitive_actions_log')
        .select('user_id')
        .eq('id', actionId)
        .single();

      if (!actionLog) {
        return { canApprove: false, reason: 'Payout not found' };
      }

      // Cannot approve own payout
      if (actionLog.user_id === userId) {
        return { canApprove: false, reason: 'Cannot approve your own payout' };
      }

      // Check role authorization
      const hasRole = await this.hasAuthorizedRole(userId);
      if (!hasRole.authorized) {
        return { canApprove: false, reason: 'Not authorized to approve payouts' };
      }

      return { canApprove: true };

    } catch (error) {
      return { canApprove: false, reason: 'Approval check failed' };
    }
  }

  /**
   * Execute actual payout via Paystack/Stripe Connect
   */
  async executePayout(payoutData, actionId) {
    try {
      console.log('Processing payout via payment provider:', payoutData);

      // Get organizer details to determine payment method
      const { data: organizer, error: orgError } = await supabase
        .from('organizers')
        .select('stripe_connect_id, country_code, payout_currency')
        .eq('id', payoutData.organizerId)
        .single();

      if (orgError || !organizer) {
        throw new Error('Organizer not found');
      }

      // Determine which payout method to use
      const useStripeConnect = organizer.stripe_connect_id && 
        ['US', 'GB', 'EU', 'CA', 'AU'].includes(organizer.country_code);

      let result;

      if (useStripeConnect) {
        // Use Stripe Connect for supported countries
        const { data, error } = await supabase.functions.invoke('trigger-stripe-connect-payout', {
          body: {
            organizerId: payoutData.organizerId,
            eventId: payoutData.eventId,
            triggeredBy: actionId,
            isDonationPayout: payoutData.isDonation || false
          }
        });

        if (error) throw new Error(error.message || 'Stripe Connect payout failed');

        result = {
          success: data?.success || false,
          reference: data?.data?.reference || data?.reference,
          error: data?.message
        };
      } else {
        // Use Paystack for Nigeria, Ghana, and other African countries
        const { data, error } = await supabase.functions.invoke('trigger-paystack-payout', {
          body: {
            organizerId: payoutData.organizerId,
            eventId: payoutData.eventId,
            triggeredBy: actionId,
            isDonationPayout: payoutData.isDonation || false
          }
        });

        if (error) throw new Error(error.message || 'Paystack payout failed');

        result = {
          success: data?.success || false,
          reference: data?.data?.reference || data?.reference,
          error: data?.message
        };
      }

      // Log the payout result
      console.log('Payout result:', result);

      return result;

    } catch (error) {
      console.error('Payout execution error:', error);
      return {
        success: false,
        error: error.message || 'Payout processing failed'
      };
    }
  }

  /**
   * Schedule payout for later processing
   */
  async schedulePayout(actionId, payoutData) {
    // In production, this would use a job queue or cron job
    console.log(`Payout ${actionId} scheduled for 24 hours from now`);
    
    // Update scheduled time in the database
    await supabase
      .from('sensitive_actions_log')
      .update({
        metadata: {
          ...payoutData,
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })
      .eq('id', actionId);
  }

  /**
   * Notify other authorized users for approval
   */
  async notifyForApproval(actionId, payoutData) {
    try {
      // Get all users with payout approval permissions
      const { data: authorizedUsers } = await supabase
        .from('user_role_assignments')
        .select(`
          user_id,
          profiles(email, full_name, phone_number),
          role:user_roles(name, can_process_payouts)
        `)
        .eq('is_active', true)
        .in('role.name', this.authorizedRoles);

      // Send notifications (email, SMS, in-app)
      for (const userAssignment of authorizedUsers || []) {
        if (userAssignment.profiles && userAssignment.role?.can_process_payouts) {
          // Send email notification
          await supabase.functions.invoke('send-email', {
            body: {
              to: userAssignment.profiles.email,
              template: 'payout_approval_required',
              data: {
                amount: payoutData.amount,
                currency: payoutData.currency,
                actionId,
                approvalUrl: `${process.env.FRONTEND_URL}/admin/finance/approve-payout/${actionId}`
              }
            }
          });

          // Log notification
          await this.logSecurityEvent(userAssignment.user_id, 'payout_approval_requested', {
            actionId,
            amount: payoutData.amount,
            notificationType: 'email'
          });
        }
      }

    } catch (error) {
      console.error('Notification Error:', error);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(userId, eventType, metadata = {}, riskLevel = 'medium') {
    try {
      await supabase.rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: eventType,
        p_event_category: 'finance',
        p_description: `Payout security event: ${eventType.replace('_', ' ')}`,
        p_risk_level: riskLevel,
        p_metadata: metadata
      });
    } catch (error) {
      console.error('Security Logging Error:', error);
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId) {
    try {
      const canApprove = await this.hasAuthorizedRole(userId);
      if (!canApprove.authorized) {
        return [];
      }

      const { data: pendingActions } = await supabase
        .from('sensitive_actions_log')
        .select(`
          *,
          initiator:profiles!user_id(email, full_name)
        `)
        .eq('action_type', 'process_payout')
        .eq('status', 'pending_approval')
        .neq('user_id', userId) // Cannot approve own payouts
        .order('created_at', { ascending: false });

      return pendingActions || [];

    } catch (error) {
      console.error('Get Pending Approvals Error:', error);
      return [];
    }
  }
}

export const payoutSecurity = new PayoutSecurityService();