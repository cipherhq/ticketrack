import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useImpersonation } from './ImpersonationContext';
import {
  hasPaymentGateway as checkHasPaymentGateway,
  shouldShowPrecreatePrompt,
  shouldShowPostcreatePrompt,
  shouldShowDashboardBanner,
  calculateSnoozeUntil,
} from '../components/PaymentGatewayPrompt';

const OrganizerContext = createContext(null);

export function OrganizerProvider({ children }) {
  const [organizer, setOrganizer] = useState({ id: null, business_name: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventCount, setEventCount] = useState(0);

  // Get impersonation context
  const impersonation = useImpersonation();
  const isImpersonating = impersonation?.isImpersonating;
  const impersonationType = impersonation?.impersonationType;
  const impersonationTarget = impersonation?.impersonationTarget;

  useEffect(() => {
    loadOrganizer();
  }, [isImpersonating, impersonationTarget?.id]);

  const loadOrganizer = async () => {
    try {
      // If impersonating an organizer, use the impersonated organizer
      if (isImpersonating && impersonationType === 'organizer' && impersonationTarget?.id) {
        const { data: impersonatedOrg } = await supabase
          .from('organizers')
          .select('*')
          .eq('id', impersonationTarget.id)
          .single();

        if (impersonatedOrg) {
          setOrganizer(impersonatedOrg);
          // Load event count for impersonated organizer
          const { count } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('organizer_id', impersonatedOrg.id);
          setEventCount(count || 0);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Demo mode - no organizer
        setOrganizer({ id: null, business_name: null });
        return;
      }

      // Try to get existing organizer
      let { data: existingOrg } = await supabase
        .from('organizers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingOrg) {
        setOrganizer(existingOrg);
        // Load event count
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organizer_id', existingOrg.id);
        setEventCount(count || 0);
      } else {
        // Get profile data for new organizer
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, country_code')
          .eq('id', user.id)
          .single();

        // Create new organizer with profile data
        const { data: newOrg, error } = await supabase
          .from('organizers')
          .insert({
            user_id: user.id,
            business_name: profile?.full_name || null,
            country_code: profile?.country_code || null,
            is_active: true,
          })
          .select()
          .single();

        if (!error && newOrg) {
          setOrganizer(newOrg);
          setEventCount(0); // New organizer has no events

          // Send welcome email to new organizer
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'organizer_welcome',
                to: user.email,
                data: {
                  businessName: newOrg.business_name || profile?.full_name || 'there',
                  appUrl: window.location.origin
                }
              }
            });
          } catch (emailErr) {
            console.error('Failed to send organizer welcome email:', emailErr);
            // Don't fail organizer creation if email fails
          }
        }
      }
    } catch (err) {
      console.error('Error loading organizer:', err);
      // Keep demo organizer on error
    }
  };

  const refreshOrganizer = () => loadOrganizer();

  // ============================================
  // Payment Prompt Management Functions
  // ============================================

  // Dismiss pre-create prompt permanently
  const dismissPrecreatePrompt = useCallback(async () => {
    if (!organizer?.id) return false;

    try {
      const { error } = await supabase
        .from('organizers')
        .update({ dismissed_precreate_prompt: true })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, dismissed_precreate_prompt: true }));
      return true;
    } catch (err) {
      console.error('Error dismissing pre-create prompt:', err);
      return false;
    }
  }, [organizer?.id]);

  // Dismiss post-create prompt permanently
  const dismissPostcreatePrompt = useCallback(async () => {
    if (!organizer?.id) return false;

    try {
      const { error } = await supabase
        .from('organizers')
        .update({ dismissed_postcreate_prompt: true })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, dismissed_postcreate_prompt: true }));
      return true;
    } catch (err) {
      console.error('Error dismissing post-create prompt:', err);
      return false;
    }
  }, [organizer?.id]);

  // Dismiss dashboard banner permanently
  const dismissDashboardBanner = useCallback(async () => {
    if (!organizer?.id) return false;

    try {
      const { error } = await supabase
        .from('organizers')
        .update({ dismissed_dashboard_banner: true })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, dismissed_dashboard_banner: true }));
      return true;
    } catch (err) {
      console.error('Error dismissing dashboard banner:', err);
      return false;
    }
  }, [organizer?.id]);

  // Snooze pre-create prompt for X days
  const snoozePrecreatePrompt = useCallback(async (days = 7) => {
    if (!organizer?.id) return false;

    try {
      const snoozeUntil = calculateSnoozeUntil(days);
      const { error } = await supabase
        .from('organizers')
        .update({ precreate_prompt_snoozed_until: snoozeUntil })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, precreate_prompt_snoozed_until: snoozeUntil }));
      return true;
    } catch (err) {
      console.error('Error snoozing pre-create prompt:', err);
      return false;
    }
  }, [organizer?.id]);

  // Snooze post-create prompt for X days
  const snoozePostcreatePrompt = useCallback(async (days = 7) => {
    if (!organizer?.id) return false;

    try {
      const snoozeUntil = calculateSnoozeUntil(days);
      const { error } = await supabase
        .from('organizers')
        .update({ postcreate_prompt_snoozed_until: snoozeUntil })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, postcreate_prompt_snoozed_until: snoozeUntil }));
      return true;
    } catch (err) {
      console.error('Error snoozing post-create prompt:', err);
      return false;
    }
  }, [organizer?.id]);

  // Snooze dashboard banner for X days
  const snoozeDashboardBanner = useCallback(async (days = 7) => {
    if (!organizer?.id) return false;

    try {
      const snoozeUntil = calculateSnoozeUntil(days);
      const { error } = await supabase
        .from('organizers')
        .update({ dashboard_banner_snoozed_until: snoozeUntil })
        .eq('id', organizer.id);

      if (error) throw error;
      setOrganizer(prev => ({ ...prev, dashboard_banner_snoozed_until: snoozeUntil }));
      return true;
    } catch (err) {
      console.error('Error snoozing dashboard banner:', err);
      return false;
    }
  }, [organizer?.id]);

  // Computed values for prompt visibility
  const hasPaymentGateway = checkHasPaymentGateway(organizer);
  const showPrecreatePrompt = shouldShowPrecreatePrompt(organizer, eventCount);
  const showDashboardBanner = shouldShowDashboardBanner(organizer);

  return (
    <OrganizerContext.Provider value={{
      organizer,
      loading,
      error,
      eventCount,
      refreshOrganizer,
      isOrganizer: true,
      // Payment gateway status
      hasPaymentGateway,
      // Prompt visibility
      showPrecreatePrompt,
      showDashboardBanner,
      // Check functions (for use with additional params)
      shouldShowPrecreatePrompt: (count) => shouldShowPrecreatePrompt(organizer, count ?? eventCount),
      shouldShowPostcreatePrompt: (hasPaidContent) => shouldShowPostcreatePrompt(organizer, hasPaidContent),
      shouldShowDashboardBanner: () => shouldShowDashboardBanner(organizer),
      // Dismiss functions
      dismissPrecreatePrompt,
      dismissPostcreatePrompt,
      dismissDashboardBanner,
      // Snooze functions
      snoozePrecreatePrompt,
      snoozePostcreatePrompt,
      snoozeDashboardBanner,
    }}>
      {children}
    </OrganizerContext.Provider>
  );
}

export function useOrganizer() {
  const context = useContext(OrganizerContext);
  if (!context) {
    throw new Error('useOrganizer must be used within an OrganizerProvider');
  }
  return context;
}

// Re-export helper functions for use outside of context
export {
  checkHasPaymentGateway as hasPaymentGateway,
  shouldShowPrecreatePrompt,
  shouldShowPostcreatePrompt,
  shouldShowDashboardBanner,
  calculateSnoozeUntil,
};
