// src/pages/JoinInstitution.tsx
// Public page for accepting institution invitations via link.
// Route: /join/:inviteToken

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Building2, CheckCircle, AlertTriangle, LogIn } from 'lucide-react';
import { toast } from 'sonner';

const JoinInstitution: React.FC = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error'>('loading');
  const [inviteInfo, setInviteInfo] = useState<{
    institutionName: string;
    role: string;
    inviterEmail: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch invite details
  useEffect(() => {
    if (!inviteToken) {
      setStatus('error');
      setErrorMessage('Invalid invite link.');
      return;
    }

    const fetchInvite = async () => {
      try {
        const { data, error } = await supabase
          .from('institution_invites')
          .select(`
            id,
            role,
            email,
            status,
            institution:institutions(name)
          `)
          .eq('invite_token', inviteToken)
          .maybeSingle();

        if (error || !data) {
          setStatus('error');
          setErrorMessage('This invite link is invalid or has expired.');
          return;
        }

        if (data.status !== 'pending') {
          setStatus('error');
          setErrorMessage('This invitation has already been used or revoked.');
          return;
        }

        setInviteInfo({
          institutionName: (data.institution as any)?.name || 'Unknown Institution',
          role: data.role || 'member',
          inviterEmail: data.email || '',
        });
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorMessage('Failed to load invite details.');
      }
    };

    fetchInvite();
  }, [inviteToken]);

  const handleAccept = async () => {
    if (!user || !inviteToken) return;

    setStatus('accepting');
    try {
      const { data, error } = await supabase.functions.invoke('accept-institution-invite', {
        body: { inviteToken },
      });

      if (error) throw error;

      toast.success('You\'ve joined the institution!');
      setStatus('success');

      // Redirect to educator portal after 2s
      setTimeout(() => navigate('/educator'), 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Failed to accept invitation.');
      toast.error('Failed to accept invitation');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-xl">
        <CardContent className="p-8">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="text-gray-500">Loading invitation...</p>
            </div>
          )}

          {status === 'ready' && inviteInfo && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  You're invited!
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  You've been invited to join{' '}
                  <strong>{inviteInfo.institutionName}</strong> as a{' '}
                  <span className="capitalize">{inviteInfo.role}</span>.
                </p>
              </div>

              {user ? (
                <Button
                  size="lg"
                  onClick={handleAccept}
                  className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <CheckCircle className="h-5 w-5" />
                  Accept Invitation
                </Button>
              ) : (
                <div className="space-y-3 w-full">
                  <p className="text-sm text-gray-500">
                    Sign in or create an account to accept this invitation.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => navigate(`/auth?redirect=/join/${inviteToken}`)}
                    className="w-full gap-2"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign In to Accept
                  </Button>
                </div>
              )}
            </div>
          )}

          {status === 'accepting' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="text-gray-500">Accepting invitation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Welcome aboard!
              </h2>
              <p className="text-gray-500">
                Redirecting to the Educator Portal...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-2xl bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Invitation Error
              </h2>
              <p className="text-gray-500">{errorMessage}</p>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinInstitution;
