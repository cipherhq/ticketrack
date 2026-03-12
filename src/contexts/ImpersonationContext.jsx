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

  // Check for existing impersonation session on mount — validate against DB
  useEffect(() => {
    const stored = sessionStorage.getItem('impersonation_session');
    if (!stored) return;

    const validateSession = async () => {
      try {
        const session = JSON.parse(stored);

        // Reject sessions older than 4 hours
        if (session.startedAt) {
          const ageMs = Date.now() - new Date(session.startedAt).getTime();
          if (ageMs > 4 * 60 * 60 * 1000) {
            sessionStorage.removeItem('impersonation_session');
            return;
          }
        }

        // Validate the session still exists in DB and hasn't ended
        if (session.sessionId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || user.id !== session.admin?.id) {
            sessionStorage.removeItem('impersonation_session');
            return;
          }

          const { data: logEntry } = await supabase
            .from('admin_impersonation_log')
            .select('id, ended_at')
            .eq('id', session.sessionId)
            .eq('admin_id', user.id)
            .single();

          if (!logEntry || logEntry.ended_at) {
            sessionStorage.removeItem('impersonation_session');
            return;
          }
        }

        setIsImpersonating(true);
        setImpersonationType(session.type);
        setImpersonationTarget(session.target);
        setAdminInfo(session.admin);
        setSessionId(session.sessionId);
      } catch (e) {
        sessionStorage.removeItem('impersonation_session');
      }
    };

    validateSession();
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

      sessionStorage.setItem('impersonation_session', JSON.stringify(session));
      
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

      sessionStorage.removeItem('impersonation_session');
      
      setIsImpersonating(false);
      setImpersonationType(null);
      setImpersonationTarget(null);
      setAdminInfo(null);
      setSessionId(null);

      return true;
    } catch (error) {
      console.error('Error ending impersonation:', error);
      // Still clear local state even if DB update fails
      sessionStorage.removeItem('impersonation_session');
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
