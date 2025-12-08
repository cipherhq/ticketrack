import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const PromoterContext = createContext({});

export function PromoterProvider({ children }) {
  const { user } = useAuth();
  const [promoter, setPromoter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPromoter();
    } else {
      setPromoter(null);
      setLoading(false);
    }
  }, [user]);

  const loadPromoter = async () => {
    try {
      const { data, error } = await supabase
        .from('promoters')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setPromoter(data);
      }
    } catch (error) {
      console.error('Error loading promoter:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPromoter = () => loadPromoter();

  return (
    <PromoterContext.Provider value={{ promoter, loading, refreshPromoter }}>
      {children}
    </PromoterContext.Provider>
  );
}

export function usePromoter() {
  const context = useContext(PromoterContext);
  if (!context) {
    throw new Error('usePromoter must be used within a PromoterProvider');
  }
  return context;
}
