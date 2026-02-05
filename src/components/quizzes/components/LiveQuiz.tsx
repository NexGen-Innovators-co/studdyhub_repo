// src/components/quizzes/components/LiveQuiz.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '../../../hooks/use-toast';
import {
  LiveQuizSession,
  LiveQuizPlayer,
  LiveQuizQuestion,
  LiveQuizAnswer,
  getSessionState,
  getActiveSessions,
  subscribeToSession,
  endQuizSession,
} from '@/services/liveQuizService';
import LiveQuizMenu from './LiveQuizMenu';
import LiveQuizHostLobby from './LiveQuizHostLobby';
import LiveQuizParticipantLobby from './LiveQuizParticipantLobby';
import LiveQuizActive from './LiveQuizActive';
import LiveQuizResults from './LiveQuizResults';
import IndividualAutoMode from './IndividualAutoMode';

interface LiveQuizProps {
  userId: string;
  userName: string;
  quizzes: any[];
  onStateChange?: (state: {
    viewMode: ViewMode;
    session: LiveQuizSession | null;
    players: LiveQuizPlayer[];
    currentQuestion: LiveQuizQuestion | null;
  }) => void;
}

type ViewMode = 'menu' | 'host-lobby' | 'participant-lobby' | 'quiz-active' | 'results';

export const LiveQuiz: React.FC<LiveQuizProps> = ({ userId, userName, quizzes, onStateChange }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('menu');
  const [session, setSession] = useState<LiveQuizSession | null>(null);
  const [players, setPlayers] = useState<LiveQuizPlayer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<LiveQuizQuestion | null>(null);
  const [allQuestions, setAllQuestions] = useState<LiveQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<LiveQuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState(userName || '');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [hostRole, setHostRole] = useState<'participant' | 'mediator'>('participant');
  const [advanceMode, setAdvanceMode] = useState<'auto' | 'manual'>('auto');
  const [questionTimeLimit, setQuestionTimeLimit] = useState<number>(30);
  const [isPlayer, setIsPlayer] = useState<boolean>(true);
  const [debugMode, setDebugMode] = useState(false);
  const { toast } = useToast();

  const isHost = session?.host_user_id === userId;
  const effectiveQuizMode = session?.quiz_mode || session?.config?.quiz_mode || 'synchronized';

  // Ref to track the last question id we rendered so we can detect changes
  // reliably without stale closure issues.
  const lastQuestionIdRef = useRef<string | null>(null);
  
  // Ref to track if we've already called endQuizSession (to avoid duplicate calls)
  const sessionEndedRef = useRef<boolean>(false);

    // Notify parent of state changes
    useEffect(() => {
      if (onStateChange) {
        onStateChange({ viewMode, session, players, currentQuestion });
      }
    }, [viewMode, session, players, currentQuestion, onStateChange]);

  const refreshSessionState = useCallback(async () => {
    if (!session) return;

    try {
      const sessionState = await getSessionState(session.id);
      if (!sessionState) return;

      // --- Determine the effective current question ---
      let effectiveCurrentQuestion = sessionState.current_question;

      if (!effectiveCurrentQuestion && sessionState.session.status === 'in_progress' && sessionState.questions?.length > 0) {
        const now = new Date();
        const activeQuestion = sessionState.questions.find((q: LiveQuizQuestion) => {
          const startTime = q.start_time ? new Date(q.start_time) : null;
          const endTime = q.end_time ? new Date(q.end_time) : null;
          return startTime && (!endTime || endTime > now);
        });

        if (activeQuestion) {
          effectiveCurrentQuestion = activeQuestion;
        } else if (sessionState.questions.every((q: LiveQuizQuestion) => q.end_time)) {
          // All questions ended — show results
          setSession(prev => prev ? { ...prev, status: 'completed' } : null);
          setViewMode('results');
          
          // End the session in the database if we're the host and haven't already
          if (isHost && !sessionEndedRef.current && session?.id) {
            sessionEndedRef.current = true;
            endQuizSession(session.id).catch(err => {
              // console.error('Failed to end session:', err);
            });
          }
          return;
        }
      }

      // --- Detect question change BEFORE updating state ---
      const questionChanged = lastQuestionIdRef.current !== null &&
        effectiveCurrentQuestion?.id !== lastQuestionIdRef.current;

      // --- Commit state updates ---
      setSession(sessionState.session);
      setAnswers(sessionState.answers || []);
      setPlayers(sessionState.players || []);
      setCurrentQuestion(effectiveCurrentQuestion || null);
      setAllQuestions(sessionState.questions || []);

      // Update the ref
      if (effectiveCurrentQuestion) {
        lastQuestionIdRef.current = effectiveCurrentQuestion.id;
      }

      // --- Determine isPlayer ---
      if (userId === sessionState.session.host_user_id) {
        setIsPlayer(sessionState.session.host_role === 'participant');
      } else {
        setIsPlayer(true);
      }

      // FIX: Reset answer state whenever the question changes, regardless of
      // whether the user is a host-participant or a regular participant.
      // The old code had `&& !isHost` which caused the host's selectedAnswer
      // to bleed into the next question.
      if (questionChanged && effectiveCurrentQuestion) {
        setHasAnswered(false);
        setSelectedAnswer(null);
      }

      // --- View-mode transitions based on session status ---
      if (sessionState.session.status === 'in_progress' && viewMode !== 'quiz-active') {
        setViewMode('quiz-active');
        // Also reset on first entry into quiz-active
        setHasAnswered(false);
        setSelectedAnswer(null);
      } else if (sessionState.session.status === 'completed' && viewMode !== 'results') {
        setViewMode('results');
      } else if (sessionState.session.status === 'waiting' && viewMode === 'quiz-active') {
        setViewMode(sessionState.session.host_user_id === userId ? 'host-lobby' : 'participant-lobby');
      }
    } catch (err: any) {
      // console.error('Error refreshing session state:', err);
      toast({
        title: 'Failed to load quiz',
        description: err.message || 'Could not retrieve session data',
        variant: 'destructive',
      });
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        setTimeout(() => resetView(), 2000);
      }
    }
  }, [session?.id, viewMode, userId, toast]);

  // Subscribe to Supabase realtime updates
  useEffect(() => {
    if (!session) return;

    const unsubscribe = subscribeToSession(session.id, () => {
      refreshSessionState();
    });

    return () => unsubscribe();
  }, [session?.id, refreshSessionState]);

  // Initial refresh when entering a lobby
  useEffect(() => {
    if (session && (viewMode === 'host-lobby' || viewMode === 'participant-lobby')) {
      refreshSessionState();
    }
  }, [viewMode, session?.id, refreshSessionState]);

  // SINGLE consolidated polling loop for auto-advance detection.
  // Replaces the three separate polling useEffects that were racing each other.
  useEffect(() => {
    if (viewMode !== 'quiz-active' || !session || session.advance_mode !== 'auto') return;

    const pollInterval = setInterval(() => {
      refreshSessionState();
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [viewMode, session?.id, session?.advance_mode, refreshSessionState]);

  // Loading timeout: if quiz-active but no question after 10 s, bail out.
  useEffect(() => {
    if (viewMode !== 'quiz-active' || currentQuestion) return;

    const timeout = setTimeout(() => {
      toast({
        title: 'Loading Timeout',
        description: 'Taking too long to load. Returning to menu.',
        variant: 'destructive',
      });
      resetView();
    }, 10000);

    return () => clearTimeout(timeout);
  }, [viewMode, currentQuestion, toast]);

  // --- Menu helpers ---
  const fetchActiveSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const sessions = await getActiveSessions(userId);
      setActiveSessions(sessions);
    } catch (err) {
      // console.error('Error fetching active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [userId]);

  useEffect(() => {
    if (viewMode === 'menu') {
      fetchActiveSessions();
    }
  }, [viewMode, fetchActiveSessions]);

  const resetView = () => {
    setViewMode('menu');
    setSession(null);
    setPlayers([]);
    setCurrentQuestion(null);
    setAllQuestions([]);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setJoinCode('');
    setSelectedQuizId('');
    setError(null);
    setHostRole('participant');
    setAdvanceMode('auto');
    setQuestionTimeLimit(30);
    lastQuestionIdRef.current = null;
    sessionEndedRef.current = false;
    fetchActiveSessions();
  };

  // --- Timer: driven purely by currentQuestion.end_time ---
  useEffect(() => {
    if (!currentQuestion?.end_time || viewMode !== 'quiz-active') return;

    const tick = () => {
      const now = Date.now();
      const endTime = new Date(currentQuestion.end_time!).getTime();
      setTimeRemaining(Math.max(0, Math.floor((endTime - now) / 1000)));
    };

    tick(); // immediate
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion?.end_time, viewMode]);

  // --- Render ---
  switch (viewMode) {
    case 'menu':
      return (
        <LiveQuizMenu
          userId={userId}
          userName={userName}
          quizzes={quizzes}
          isLoading={isLoading}
          error={error}
          setError={setError}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          displayName={displayName}
          setDisplayName={setDisplayName}
          selectedQuizId={selectedQuizId}
          setSelectedQuizId={setSelectedQuizId}
          hostRole={hostRole}
          setHostRole={setHostRole}
          advanceMode={advanceMode}
          setAdvanceMode={setAdvanceMode}
          questionTimeLimit={questionTimeLimit}
          setQuestionTimeLimit={setQuestionTimeLimit}
          activeSessions={activeSessions}
          loadingSessions={loadingSessions}
          setSession={setSession}
          setViewMode={setViewMode}
          refreshSessionState={refreshSessionState}
          setIsLoading={setIsLoading}
          fetchActiveSessions={fetchActiveSessions}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          resetView={resetView}
          toast={toast}
        />
      );

    case 'host-lobby':
      return (
        <LiveQuizHostLobby
          session={session}
          players={players}
          isHost={isHost}
          userId={userId}
          isLoading={isLoading}
          error={error}
          refreshSessionState={refreshSessionState}
          setIsLoading={setIsLoading}
          setSession={setSession}
          setViewMode={setViewMode}
          resetView={resetView}
          toast={toast}
        />
      );

    case 'participant-lobby':
      return (
        <LiveQuizParticipantLobby
          session={session}
          players={players}
          userId={userId}
          isLoading={isLoading}
          error={error}
          refreshSessionState={refreshSessionState}
          resetView={resetView}
          toast={toast}
        />
      );

    case 'quiz-active':
      if (effectiveQuizMode === 'individual_auto') {
        return <IndividualAutoMode sessionId={session.id} playerId={userId} />;
      }
      return (
        <LiveQuizActive
            session={session}
            answers={answers}
            players={players}
            currentQuestion={currentQuestion}
            allQuestions={allQuestions}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            hasAnswered={hasAnswered}
            setHasAnswered={setHasAnswered}
            timeRemaining={timeRemaining}
            isLoading={isLoading}
            error={error}
            setError={setError}
            isHost={isHost}
            userId={userId}
            isPlayer={isPlayer}
            refreshSessionState={refreshSessionState}
            setIsLoading={setIsLoading}
            resetView={resetView}
            toast={toast}
          />
      );

    case 'results':
      return (
        <LiveQuizResults
          session={session}
          players={players}
          userId={userId}
          resetView={resetView}
          toast={toast}
        />
      );

    default:
      return null;
  }
};

export default LiveQuiz;
