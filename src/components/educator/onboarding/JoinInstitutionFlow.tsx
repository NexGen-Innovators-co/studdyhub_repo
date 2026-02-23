// src/components/educator/onboarding/JoinInstitutionFlow.tsx
// Flow for affiliated tutors to join an existing institution via invite code.

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { School, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface JoinInstitutionFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const JoinInstitutionFlow: React.FC<JoinInstitutionFlowProps> = ({
  onComplete,
  onSkip,
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [institutionName, setInstitutionName] = useState('');

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'accept-institution-invite',
        { body: { inviteToken: inviteCode.trim() } }
      );

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
      } else {
        setInstitutionName(data?.institution?.name || 'Institution');
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to join institution');
    } finally {
      setIsJoining(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Joined {institutionName}!
        </h3>
        <p className="text-gray-500 text-center max-w-sm">
          You're now a member. You can access institution courses and resources.
        </p>
        <Button onClick={onComplete}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <School className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Join an Institution
        </h2>
        <p className="text-gray-500">
          Enter the invitation code you received from your school or institution.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Invitation Code</label>
            <Input
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError(null);
              }}
              placeholder="Paste your invitation code"
              className="font-mono text-center"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
            <Button onClick={handleJoin} disabled={!inviteCode.trim() || isJoining}>
              {isJoining && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Join Institution
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-gray-400">
        Don't have a code? Ask your institution administrator for an invitation.
      </p>
    </div>
  );
};

export default JoinInstitutionFlow;
