import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calendarIntegrationService } from '@/services/calendarIntegrationService';
import { toast } from 'sonner';

const CalendarCallback: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateRaw = params.get('state');
    let provider: 'google' | 'outlook' = 'google';
    let userId = user?.id;

    if (stateRaw) {
      try {
        const state = JSON.parse(decodeURIComponent(stateRaw));
        if (state.provider === 'google' || state.provider === 'outlook') {
          provider = state.provider;
        }
        userId = state.userId || userId;
      } catch (e) {
        setError('Invalid state parameter');
        setLoading(false);
        return;
      }
    }

    if (!code || !userId) {
      setError('Missing code or user ID');
      setLoading(false);
      return;
    }

    const handleCallback = async () => {
      try {
        await calendarIntegrationService.handleOAuthCallback(provider, code, userId);
        toast.success('Calendar connected successfully');
        navigate('/settings'); // or wherever you want to redirect
      } catch (err: any) {
        setError(err.message || 'Failed to connect calendar');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [user, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-lg">Connecting your calendar...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-600 text-lg">{error}</div>;
  }

  return null;
};

export default CalendarCallback;
