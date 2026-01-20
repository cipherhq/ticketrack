import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useImpersonation } from './ImpersonationContext';

const OrganizerContext = createContext(null);

export function OrganizerProvider({ children }) {
  const [organizer, setOrganizer] = useState({ id: null, business_name: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
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

  return (
    <OrganizerContext.Provider value={{ organizer, loading, error, refreshOrganizer, isOrganizer: true }}>
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
