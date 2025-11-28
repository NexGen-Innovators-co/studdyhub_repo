// src/components/classRecordings/hooks/useRealtimeSync.ts
import { useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { ClassRecording, Quiz } from '../../../types/Class';

interface UseRealtimeSyncProps {
  userId: string;
  onRecordingUpdate: (recording: ClassRecording) => void;
  onQuizUpdate: (quiz: Quiz) => void;
  onStatsUpdate: () => void;
}

export const useRealtimeSync = ({
  userId,
  onRecordingUpdate,
  onQuizUpdate,
  onStatsUpdate,
}: UseRealtimeSyncProps) => {
  useEffect(() => {
    if (!userId) return;

    // Subscribe to class_recordings changes
    const recordingsChannel = supabase
      .channel('class_recordings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_recordings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onRecordingUpdate(payload.new as ClassRecording);
          }
        }
      )
      .subscribe();

    // Subscribe to quizzes changes
    const quizzesChannel = supabase
      .channel('quizzes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quizzes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onQuizUpdate(payload.new as Quiz);
          }
        }
      )
      .subscribe();

    // Subscribe to user_stats changes
    const statsChannel = supabase
      .channel('user_stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onStatsUpdate();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(recordingsChannel);
      supabase.removeChannel(quizzesChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [userId, onRecordingUpdate, onQuizUpdate, onStatsUpdate]);
};