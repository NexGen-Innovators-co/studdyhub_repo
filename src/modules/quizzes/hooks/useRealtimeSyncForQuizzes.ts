// src/components/quizzes/hooks/useRealtimeSyncForQuizzes.ts
import { useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Quiz } from '../../../types/Class';

interface UseRealtimeSyncForQuizzesProps {
  userId: string;
  onQuizUpdate: (quiz: Quiz) => void;
  onStatsUpdate: () => void;
}

export const useRealtimeSyncForQuizzes = ({
  userId,
  onQuizUpdate,
  onStatsUpdate,
}: UseRealtimeSyncForQuizzesProps) => {
  useEffect(() => {
    if (!userId) return;

    // Subscribe to quizzes changes - only UPDATE events
    // INSERT events are handled locally to avoid duplication
    const quizzesChannel = supabase
      .channel('quizzes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quizzes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            const newQuiz = payload.new as any;
            const formattedQuiz: Quiz = {
              ...newQuiz,
              classId: newQuiz.class_id,
              userId: newQuiz.user_id,
              questions: typeof newQuiz.questions === 'string' ? JSON.parse(newQuiz.questions) : newQuiz.questions
            };
            onQuizUpdate(formattedQuiz);
          }
        }
      )
      .subscribe();

    // Subscribe to user_stats changes
    const statsChannel = supabase
      .channel('user_stats_quizzes')
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
      supabase.removeChannel(quizzesChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [userId, onQuizUpdate, onStatsUpdate]);
};
