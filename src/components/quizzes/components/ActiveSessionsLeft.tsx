import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Loader2, Clock, Crown, UserCog, Copy, Users, Zap, Play, LogOut } from 'lucide-react';
import { getActiveSessions, leaveQuizSession } from '@/services/liveQuizService';

interface Props {
  userId: string;
  onOpenLive: () => void;
  toast: any;
}

const ActiveSessionsLeft: React.FC<Props> = ({ userId, onOpenLive, toast }) => {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const s = await getActiveSessions(userId);
      setActiveSessions(s || []);
    } catch (err: any) {
      // console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const handleRejoin = (session: any) => {
    // persist join code and navigate to Live tab
    try {
      localStorage.removeItem('live_quiz_join_code');
      localStorage.setItem('live_quiz_join_code', session.join_code);
      onOpenLive();
      toast({ title: 'Opening Live Quiz', description: 'Switching to Live tab...' });
    } catch (err) {
      // ignore
    }
  };

  const handleLeave = async (sessionId: string) => {
    setIsProcessing(true);
    try {
      await leaveQuizSession(sessionId, userId);
      toast({ title: 'Left session' });
      fetchSessions();
    } catch (err: any) {
      toast({ title: 'Error leaving session', description: err.message || String(err), variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-amber-200/40 dark:border-amber-800 p-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-gray-900 dark:text-white">Your Active Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-amber-500" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading sessions...</p>
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="text-sm text-gray-500">No active sessions</div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((sessionData) => (
                <div key={sessionData.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-amber-200 dark:border-amber-700 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={sessionData.status === 'waiting' ? 'secondary' : 'default'}>
                          {sessionData.status === 'waiting' ? 'Waiting' : 'In Progress'}
                        </Badge>
                        {sessionData.player_info?.is_host && (
                          <Badge variant="secondary">
                            <Crown className="h-3 w-3 mr-1" />
                            Host
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Join Code:</span>
                          <span className="font-mono font-bold text-lg">{sessionData.join_code}</span>
                          <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => { navigator.clipboard.writeText(sessionData.join_code); toast({ title: 'Copied!', description: 'Join code copied to clipboard' }); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Users className="h-4 w-4" />
                          <span>Playing as: {sessionData.player_info?.display_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleRejoin(sessionData)} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
                      <Play className="h-4 w-4 mr-2" />
                      {sessionData.status === 'waiting' ? 'Rejoin Lobby' : 'Continue Quiz'}
                    </Button>
                    <Button onClick={() => handleLeave(sessionData.id)} disabled={isProcessing} variant="outline">
                      <LogOut className="h-4 w-4 mr-2" />
                      Leave
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActiveSessionsLeft;
