// src/components/classRecordings/hooks/useRealtimeSync.ts
import { useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { ClassRecording, Quiz } from '../../../types/Class';
import { toast } from 'sonner';

interface UseRealtimeSyncProps {
  userId: string;
  onRecordingUpdate: (recording: ClassRecording) => void;
  onQuizUpdate?: (quiz: Quiz) => void;
  onStatsUpdate?: () => void;
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
            const newRec = payload.new as ClassRecording;
            const oldRec = payload.old as ClassRecording | null;

            // Notify on completion
            if (newRec.processing_status === 'completed' && oldRec?.processing_status === 'processing') {
                toast.success(`Processing complete for: ${newRec.title}`);
            }
             // Notify on failure
            if (newRec.processing_status === 'failed' && oldRec?.processing_status === 'processing') {
                toast.error(`Processing failed for: ${newRec.title}`);
            }

            // Transform raw payload to match ClassRecording interface expected by UI
            const transformedRec: ClassRecording = {
              ...newRec,
              audioUrl: newRec.audio_url || newRec.audioUrl, // Ensure compatible field
              userId: newRec.user_id || newRec.userId // Ensure compatible field
            };

            onRecordingUpdate(transformedRec);
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