import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const OrganizerContext = createContext(null);

export function OrganizerProvider({ children }) {
  const [organizer, setOrganizer] = useState({ id: null, business_name: 'My Organization' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOrganizer();
  }, []);

  const loadOrganizer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Demo mode - use placeholder organizer
        setOrganizer({ id: null, business_name: 'My Organization' });
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
        // Create new organizer
        const { data: newOrg, error } = await supabase
          .from('organizers')
          .insert({ 
            user_id: user.id, 
            business_name: 'My Organization', 
            is_active: true 
          })
          .select()
          .single();
        
        if (!error && newOrg) {
          setOrganizer(newOrg);
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
