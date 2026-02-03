// --- Individual Auto Mode Interfaces ---
export interface PlayerQuestionProgress {
  id: string;
  session_id: string;
  player_id: string;
  question_id: string;
  question_index: number;
  selected_option?: number;
  is_correct?: boolean;
  points_awarded: number;
  time_spent: number;
  started_at?: string;
  answered_at?: string;
  status: 'pending' | 'answered' | 'skipped' | 'timeout';
}

export interface IndividualQuizState {
  session: LiveQuizSession;
  questions: LiveQuizQuestion[];
  playerProgress: PlayerQuestionProgress[];
  currentQuestionIndex: number;
  timeSpentOnCurrent: number;
  leaderboard: Array<{
    player_id: string;
    display_name: string;
    avatar_url?: string | null;
    score: number;
    questions_attempted: number;
    questions_correct: number;
    total_time_spent: number;
    accuracy: number;
    current_question_idx: number;
    status: string;
  }>;
}
// --- Individual Auto Mode Service Functions ---
/**
 * Initialize individual progress for all players in a session
 */
export async function initializeIndividualProgress(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'initialize-individual-progress',
        session_id: sessionId,
      },
    });
    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get complete state for individual auto mode
 */
export async function getIndividualQuizState(sessionId: string, playerId: string): Promise<IndividualQuizState | null> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'get-individual-quiz-state',
        session_id: sessionId,
        player_id: playerId,
      },
    });
    if (error) {
      // console.error('getIndividualQuizState error:', error);
      return null;
    }
    if (data?.error) {
      // console.error('getIndividualQuizState data error:', data.error);
      return null;
    }
    return data as IndividualQuizState;
  } catch (error) {
    // console.error('getIndividualQuizState exception:', error);
    return null;
  }
}

/**
 * Submit answer for individual mode
 */
export async function submitAnswerIndividual(params: {
  sessionId: string;
  playerId: string;
  questionId: string;
  questionIndex: number;
  selectedOption: number;
  timeSpent: number;
}): Promise<{ success: boolean; isCorrect?: boolean; points?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'submit-answer-individual',
        session_id: params.sessionId,
        player_id: params.playerId,
        question_id: params.questionId,
        question_index: params.questionIndex,
        selected_option: params.selectedOption,
        time_spent: params.timeSpent,
      },
    });
    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };
    return {
      success: true,
      isCorrect: data?.is_correct,
      points: data?.points_awarded,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Manually advance to next question (individual mode)
 */
export async function advanceIndividual(sessionId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'advance-individual',
        session_id: sessionId,
        player_id: playerId,
      },
    });
    if (error) return { success: false, error: error.message };
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check and handle timeouts for individual mode
 */
export async function checkIndividualTimeout(sessionId: string, playerId: string): Promise<{ timeout: boolean; autoAdvanced?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'check-individual-timeout',
        session_id: sessionId,
        player_id: playerId,
      },
    });
    if (error) return { timeout: false, error: error.message };
    return {
      timeout: data?.timeout || false,
      autoAdvanced: data?.auto_advanced,
    };
  } catch (error: any) {
    return { timeout: false, error: error.message };
  }
}

/**
 * Get real-time leaderboard for individual mode
 */
export async function getRealtimeLeaderboard(sessionId: string): Promise<IndividualQuizState['leaderboard'] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: {
        action: 'get-realtime-leaderboard',
        session_id: sessionId,
      },
    });
    if (error || data?.error) return null;
    return data?.leaderboard || null;
  } catch (error) {
    return null;
  }
}
// src/services/liveQuizService.ts
import { supabase } from '../integrations/supabase/client';

export interface LiveQuizSession {
  id: string;
  quiz_id: string;
  host_user_id: string;
  join_code: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  created_at: string;
  updated_at?: string;
  host_role: 'participant' | 'mediator';
  advance_mode: 'auto' | 'manual';
  config: {
    question_time_limit: number;
    auto_advance: boolean;
    quiz_mode?: 'synchronized' | 'individual_auto';
  };
  quiz_mode?: 'synchronized' | 'individual_auto';
}

export interface LiveQuizPlayer {
  id: string;
  session_id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  score: number;
  is_host: boolean;
  is_playing: boolean;
  is_mediator?: boolean;
  joined_at: string;
  last_answered_at?: string;
}

export interface LiveQuizQuestion {
  id: string;
  session_id: string;
  question_index: number;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
  time_limit?: number;
  start_time?: string;
  end_time?: string;
  status?: string;
}

export interface LiveQuizAnswer {
  id: string;
  session_id: string;
  question_id: string;
  user_id: string;
  selected_option: number;
  is_correct: boolean;
  answered_at: string;
  time_taken?: number;
  points_awarded?: number;
  status?: string;
}

export interface SessionState {
  session: LiveQuizSession;
  players: LiveQuizPlayer[];
  questions: LiveQuizQuestion[];
  current_question: LiveQuizQuestion | null;
  answers: LiveQuizAnswer[];
}

/**
 * Create a new live quiz session
 */
export async function createLiveQuizSession(
  quizId?: string,
  customQuestions?: any[],
  hostRole: 'participant' | 'mediator' = 'participant',
  advanceMode: 'auto' | 'manual' = 'auto',
  questionTimeLimit: number = 30,
  quizMode: 'synchronized' | 'individual_auto' = 'synchronized'
): Promise<{ session: LiveQuizSession | null; joinCode?: string; error?: string }> {
  try {
    const payload: any = { 
      action: 'create-session',
      host_role: hostRole,
      advance_mode: advanceMode,
      question_time_limit: questionTimeLimit,
      quiz_mode: quizMode
    };
    
    if (customQuestions && customQuestions.length > 0) {
      payload.questions = customQuestions.map(q => ({
        ...q,
        time_limit: questionTimeLimit
      }));
    } else if (quizId) {
      payload.quiz_id = quizId;
    } else {
      return { session: null, error: 'Either quizId or customQuestions must be provided' };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: payload,
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { session: null, error: error.message || 'Failed to create session' };
    }

    if (!data || !data.session) {
      return { session: null, error: data?.error || 'Failed to create session' };
    }

    return { 
      session: data.session, 
      joinCode: data.join_code 
    };
  } catch (error: any) {
    // console.error('Error creating session:', error);
    return { session: null, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Join an existing live quiz session
 */
export async function joinLiveQuizSession(
  joinCode: string,
  displayName: string
): Promise<{ session: LiveQuizSession | null; error?: string }> {
  try {
    if (!joinCode || !displayName) {
      return { session: null, error: 'Join code and display name are required' };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'join-session',
        join_code: joinCode.toUpperCase(),
        display_name: displayName
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { session: null, error: error.message || 'Failed to join session' };
    }

    if (!data || data.error) {
      return { session: null, error: data?.error || 'Session not found or already started' };
    }

    return { session: data.session };
  } catch (error: any) {
    // console.error('Error joining session:', error);
    return { session: null, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Start the quiz (host only)
 */
export async function startLiveQuizSession(
  sessionId: string,
  quizMode?: 'synchronized' | 'individual_auto'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }

    // If individual auto mode, initialize player progress
    if (quizMode === 'individual_auto') {
      const initResult = await initializeIndividualProgress(sessionId);
      if (initResult.error) {
        // console.error('Failed to initialize individual progress:', initResult.error);
        return { success: false, error: initResult.error };
      }
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'start-session',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { success: false, error: error.message || 'Failed to start session' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    // console.error('Error starting session:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
// Add this new function to liveQuizService.ts
/**
 * Check and handle question timeout with auto-advance
 */
export async function handleQuestionTimeout(
  sessionId: string
): Promise<{ 
  timeout: boolean; 
  advanced: boolean; 
  nextQuestionIndex?: number;
  error?: string 
}> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'check-question-timeout',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Error checking timeout:', error);
      return { timeout: false, advanced: false, error: error.message };
    }

    return { 
      timeout: data?.timeout || false,
      advanced: data?.auto_advanced || false,
      nextQuestionIndex: data?.next_question_index
    };
  } catch (error: any) {
    // console.error('Error handling timeout:', error);
    return { timeout: false, advanced: false, error: error.message };
  }
}

/**
 * Force refresh to next question (for participants)
 */
export async function forceNextQuestionRefresh(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current session state
    const sessionState = await getSessionState(sessionId);
    
    if (!sessionState) {
      return { success: false, error: 'Session not found' };
    }

    // Check if current question has timed out
    if (sessionState.current_question?.end_time) {
      const endTime = new Date(sessionState.current_question.end_time);
      const now = new Date();
      
      if (now > endTime) {
        // Question has ended, try to get next question
        const nextQuestionIndex = (sessionState.current_question.question_index || 0) + 1;
        
        if (nextQuestionIndex < sessionState.questions.length) {
          // There's a next question, refresh to show it
          return { success: true };
        } else {
          // No more questions, end session
          return { success: true };
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    // console.error('Error forcing refresh:', error);
    return { success: false, error: error.message };
  }
}
/**
 * Force refresh session state with auto-advance detection
 */
export async function refreshSessionWithAutoAdvance(
  sessionId: string
): Promise<SessionState | null> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'refresh-session',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Refresh session error:', error);
      return null;
    }

    return data;
  } catch (error) {
    // console.error('Error refreshing session:', error);
    return null;
  }
}
/**
 * Submit an answer
 */
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  selectedOption: number,
  timeTaken?: number
): Promise<{ success: boolean; isCorrect: boolean; points: number; error?: string }> {
  try {
    if (!sessionId || !questionId || typeof selectedOption !== 'number') {
      return { 
        success: false, 
        isCorrect: false, 
        points: 0, 
        error: 'Invalid parameters' 
      };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'submit-answer',
        session_id: sessionId,
        question_id: questionId,
        answer_index: selectedOption,
        time_taken: timeTaken
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { 
        success: false, 
        isCorrect: false, 
        points: 0, 
        error: error.message || 'Failed to submit answer' 
      };
    }

    if (data?.error) {
      return { 
        success: false, 
        isCorrect: false, 
        points: 0, 
        error: data.error 
      };
    }

    return { 
      success: true, 
      isCorrect: data?.is_correct || false, 
      points: data?.points_awarded || 0 
    };
  } catch (error: any) {
    // console.error('Error submitting answer:', error);
    return { 
      success: false, 
      isCorrect: false, 
      points: 0, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
}

/**
 * Advance to next question (host only)
 */
export async function advanceToNextQuestion(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'next-question',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { success: false, error: error.message || 'Failed to advance question' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    // console.error('Error advancing question:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Auto-advance to next question (for auto mode)
 */
export async function autoAdvanceQuestion(
  sessionId: string
): Promise<{ success: boolean; nextQuestionIndex?: number; error?: string }> {
  try {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'advance-question-auto',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { success: false, error: error.message || 'Failed to auto-advance question' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { 
      success: true,
      nextQuestionIndex: data?.next_question_index 
    };
  } catch (error: any) {
    // console.error('Error auto-advancing question:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Check if question has timed out
 */
export async function checkQuestionTimeout(
  sessionId: string
): Promise<{ timeout: boolean; autoAdvanced?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'check-question-timeout',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Error checking timeout:', error);
      return { timeout: false, error: error.message };
    }

    return { 
      timeout: data?.timeout || false,
      autoAdvanced: data?.auto_advanced 
    };
  } catch (error: any) {
    // console.error('Error checking timeout:', error);
    return { timeout: false, error: error.message };
  }
}

/**
 * Get session state
 */
export async function getSessionState(
  sessionId: string
): Promise<SessionState | null> {
  try {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'get-session-state',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return null;
    }

    if (data?.error) {
      // console.error('Session state error:', data.error);
      return null;
    }

    return {
      session: data?.session,
      players: data?.players || [],
      questions: data?.questions || [],
      current_question: data?.current_question,
      answers: data?.answers || []
    };
  } catch (error) {
    // console.error('Error getting session state:', error);
    return null;
  }
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(
  userId: string
): Promise<any[]> {
  try {
    const { data: playerSessions, error: playerError } = await supabase
      .from('live_quiz_players')
      .select(`
        *,
        live_quiz_sessions!inner(*)
      `)
      .eq('user_id', userId)
      .in('live_quiz_sessions.status', ['waiting', 'in_progress']);

    if (playerError) throw playerError;

    const sessions = playerSessions?.map(p => ({
      ...p.live_quiz_sessions,
      player_info: {
        display_name: p.display_name,
        is_host: p.is_host,
        is_playing: p.is_playing,
        score: p.score
      }
    })) || [];

    return sessions;
  } catch (err: any) {
    // console.error('Error fetching active sessions:', err);
    return [];
  }
}

/**
 * End a quiz session (host only)
 */
export async function endQuizSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }

    const { data, error } = await supabase.functions.invoke('live-quiz', {
      body: { 
        action: 'end-session',
        session_id: sessionId
      },
    });

    if (error) {
      // console.error('Edge function error:', error);
      return { success: false, error: error.message || 'Failed to end session' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error: any) {
    // console.error('Error ending session:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Leave a quiz session
 */
export async function leaveQuizSession(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionId || !userId) {
      return { success: false, error: 'Session ID and User ID are required' };
    }

    const { error } = await supabase
      .from('live_quiz_players')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      // console.error('Error leaving session:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    // console.error('Error leaving session:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Rejoin a session
 */
export async function rejoinSession(
  sessionData: any
): Promise<{ session: LiveQuizSession | null; error?: string }> {
  try {
    const sessionState = await getSessionState(sessionData.id);
    
    if (!sessionState || !sessionState.session) {
      return { session: null, error: 'Session not found' };
    }

    return { session: sessionState.session };
  } catch (error: any) {
    // console.error('Error rejoining session:', error);
    return { session: null, error: error.message || 'Failed to rejoin session' };
  }
}

/**
 * Fallback method to advance question
 */
export async function advanceQuestionFallback(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionId) return { success: false, error: 'Session ID required' };
    
    const sessionState = await getSessionState(sessionId);
    if (!sessionState) return { success: false, error: 'Session not found' };

    const { data: currentQuestionData, error: currentQuestionError } = await supabase
      .from('live_quiz_questions')
      .select('*')
      .eq('session_id', sessionId)
      .not('start_time', 'is', null)
      .is('end_time', null)
      .order('question_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentQuestionError) {
      throw new Error(`Database error: ${currentQuestionError.message}`);
    }

    const now = new Date();
    
    if (!currentQuestionData) {
      const { data: allQuestions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('question_index');

      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('No questions found in this session');
      }

      const completedQuestions = allQuestions.filter(q => q.end_time);
      const lastCompletedIndex = completedQuestions.length > 0 
        ? Math.max(...completedQuestions.map(q => q.question_index))
        : -1;

      const nextIndex = lastCompletedIndex + 1;

      if (nextIndex < allQuestions.length) {
        const timeLimit = allQuestions[nextIndex].time_limit || 30;
        const endTime = new Date(now.getTime() + timeLimit * 1000);

        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: now.toISOString(),
            end_time: endTime.toISOString(),
            status: 'active'
          })
          .eq('session_id', sessionId)
          .eq('question_index', nextIndex);
      } else {
        await supabase
          .from('live_quiz_sessions')
          .update({
            status: 'completed',
            end_time: now.toISOString(),
          })
          .eq('id', sessionId);
      }
    } else {
      await supabase
        .from('live_quiz_questions')
        .update({ 
          end_time: now.toISOString(),
          status: 'completed'
        })
        .eq('id', currentQuestionData.id);

      const { data: allQuestions } = await supabase
        .from('live_quiz_questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('question_index');

      const nextIndex = currentQuestionData.question_index + 1;

      if (nextIndex < (allQuestions?.length || 0)) {
        const timeLimit = allQuestions?.[nextIndex]?.time_limit || 30;
        const endTime = new Date(now.getTime() + timeLimit * 1000);

        await supabase
          .from('live_quiz_questions')
          .update({
            start_time: now.toISOString(),
            end_time: endTime.toISOString(),
            status: 'active'
          })
          .eq('session_id', sessionId)
          .eq('question_index', nextIndex);
      } else {
        await supabase
          .from('live_quiz_sessions')
          .update({
            status: 'completed',
            end_time: now.toISOString(),
          })
          .eq('id', sessionId);
      }
    }

    return { success: true };
  } catch (error: any) {
    // console.error('Fallback advance error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to session updates
 */
export function subscribeToSession(
  sessionId: string,
  onUpdate: (payload: any) => void
) {
  const channel = supabase
    .channel(`quiz-session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_quiz_sessions',
        filter: `id=eq.${sessionId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_quiz_players',
        filter: `session_id=eq.${sessionId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_quiz_questions',
        filter: `session_id=eq.${sessionId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_quiz_answers',
        filter: `session_id=eq.${sessionId}`,
      },
      onUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get completed sessions for a user
 */
export async function getPastSessions(
  userId: string
): Promise<any[]> {
  try {
    const { data: playerSessions, error: playerError } = await supabase
      .from('live_quiz_players')
      .select(`
        *,
        live_quiz_sessions!inner(*)
      `)
      .eq('user_id', userId)
      .eq('live_quiz_sessions.status', 'completed')
      .order('end_time', { ascending: false, foreignTable: 'live_quiz_sessions' });

    if (playerError) throw playerError;

    const sessions = playerSessions?.map(p => ({
      ...p.live_quiz_sessions,
      player_info: {
        display_name: p.display_name,
        is_host: p.is_host,
        is_playing: p.is_playing,
        score: p.score
      }
    })) || [];

    return sessions;
  } catch (err: any) {
    // console.error('Error fetching past sessions:', err);
    return [];
  }
}

export async function getSessionResultsById(
  sessionId: string,
  userId?: string
): Promise<{ session: LiveQuizSession | null; players: LiveQuizPlayer[]; quiz?: any; userAnswers?: any[] }> {
  try {
    // Fetch session
    const { data: sessionData, error: sessionError } = await supabase
      .from('live_quiz_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Fetch all players in this session
    const { data: playersData, error: playersError } = await supabase
      .from('live_quiz_players')
      .select('*')
      .eq('session_id', sessionId);

    if (playersError) throw playersError;

    // Fetch quiz questions from live_quiz_questions table (not restricted by RLS)
    let quizData = null;
    const { data: questions, error: questionsError } = await supabase
      .from('live_quiz_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_index', { ascending: true });
    
    if (!questionsError && questions && questions.length > 0) {
      quizData = {
        title: sessionData?.quiz_id || 'Live Quiz',
        questions: questions.map(q => ({
          id: q.id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer
        }))
      };
    }

    // Fetch user's answers if userId provided
    let userAnswers = [];
    if (userId) {
      const { data: answersData, error: answersError } = await supabase
        .from('live_quiz_answers')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      
      if (!answersError && answersData) {
        userAnswers = answersData;
      }
    }

    return {
      session: sessionData,
      players: playersData || [],
      quiz: quizData,
      userAnswers: userAnswers
    };
  } catch (err: any) {
    // console.error('Error fetching session results:', err);
    return {
      session: null,
      players: [],
      quiz: null,
      userAnswers: []
    };
  }
}
