import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const ImpersonationContext = createContext({});

export function ImpersonationProvider({ children }) {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationType, setImpersonationType] = useState(null); // organizer, attendee, affiliate
  const [impersonationTarget, setImpersonationTarget] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Check for existing impersonation session on mount
  useEffect(() => {
    const stored = localStorage.getItem('impersonation_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setIsImpersonating(true);
        setImpersonationType(session.type);
        setImpersonationTarget(session.target);
        setAdminInfo(session.admin);
        setSessionId(session.sessionId);
      } catch (e) {
        localStorage.removeItem('impersonation_session');
      }
    }
  }, []);

  const startImpersonation = async (type, target, admin) => {
    try {
      // Log impersonation start
      const { data: logEntry, error } = await supabase
        .from('admin_impersonation_log')
        .insert({
          admin_id: admin.id,
          admin_email: admin.email,
          target_organizer_id: type === 'organizer' ? target.id : null,
          target_organizer_name: type === 'organizer' ? target.business_name : null,
          reason: `Admin support access - ${type}`,
          started_at: new Date().toISOString(),
          actions_performed: [],
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to log impersonation:', error);
      }

      const session = {
        type,
        target: {
          id: target.id,
          name: type === 'organizer' ? target.business_name : 
                type === 'attendee' ? (target.full_name || target.name) : 
                target.name,
          email: target.email || target.business_email,
          user_id: target.user_id,
        },
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        },
        sessionId: logEntry?.id || null,
        startedAt: new Date().toISOString(),
      };

      localStorage.setItem('impersonation_session', JSON.stringify(session));
      
      setIsImpersonating(true);
      setImpersonationType(type);
      setImpersonationTarget(session.target);
      setAdminInfo(session.admin);
      setSessionId(logEntry?.id || null);

      return session;
    } catch (error) {
      console.error('Error starting impersonation:', error);
      throw error;
    }
  };

  const endImpersonation = async () => {
    try {
      // Log impersonation end
      if (sessionId) {
        await supabase
          .from('admin_impersonation_log')
          .update({
            ended_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      localStorage.removeItem('impersonation_session');
      
      setIsImpersonating(false);
      setImpersonationType(null);
      setImpersonationTarget(null);
      setAdminInfo(null);
      setSessionId(null);

      return true;
    } catch (error) {
      console.error('Error ending impersonation:', error);
      // Still clear local state even if DB update fails
      localStorage.removeItem('impersonation_session');
      setIsImpersonating(false);
      setImpersonationType(null);
      setImpersonationTarget(null);
      setAdminInfo(null);
      setSessionId(null);
      return true;
    }
  };

  const logAction = async (action, details = {}) => {
    if (!sessionId) return;

    try {
      // Get current actions
      const { data } = await supabase
        .from('admin_impersonation_log')
        .select('actions_performed')
        .eq('id', sessionId)
        .single();

      const actions = data?.actions_performed || [];
      actions.push({
        action,
        details,
        timestamp: new Date().toISOString(),
      });

      await supabase
        .from('admin_impersonation_log')
        .update({ actions_performed: actions })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonationType,
        impersonationTarget,
        adminInfo,
        startImpersonation,
        endImpersonation,
        logAction,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return context;
}
