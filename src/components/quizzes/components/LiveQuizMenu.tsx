// src/components/quizzes/components/LiveQuizMenu.tsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import { ScrollArea } from '../../ui/scroll-area';
import { 
  Users, 
  Play, 
  Trophy, 
  Clock, 
  Copy,
  Loader2,
  Crown,
  Zap,
  AlertCircle,
  LogOut,
  RefreshCw,
  Settings,
  UserCog,
  XCircle,
  ArrowRight,
  Sparkles,
  Radio,
  UserPlus,
  Rocket,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createLiveQuizSession, joinLiveQuizSession, leaveQuizSession, rejoinSession, getAvailableSessions } from '@/services/liveQuizService';
import { LiveQuizSession } from '@/services/liveQuizService';

interface LiveQuizMenuProps {
  userId: string;
  userName: string;
  quizzes: any[];
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  joinCode: string;
  setJoinCode: (code: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  selectedQuizId: string;
  setSelectedQuizId: (id: string) => void;
  hostRole: 'participant' | 'mediator';
  setHostRole: (role: 'participant' | 'mediator') => void;
  advanceMode: 'auto' | 'manual';
  setAdvanceMode: (mode: 'auto' | 'manual') => void;
  questionTimeLimit: number;
  setQuestionTimeLimit: (limit: number) => void;
  activeSessions: any[];
  loadingSessions: boolean;
  setSession: (session: LiveQuizSession | null) => void;
  setViewMode: (mode: 'menu' | 'host-lobby' | 'participant-lobby' | 'quiz-active' | 'results') => void;
  refreshSessionState: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  fetchActiveSessions: () => Promise<void>;
  debugMode: boolean;
  setDebugMode: (debug: boolean) => void;
  resetView: () => void;
  toast: any;
}

const LiveQuizMenu: React.FC<LiveQuizMenuProps> = ({
  userId,
  userName,
  quizzes,
  isLoading,
  error,
  setError,
  joinCode,
  setJoinCode,
  displayName,
  setDisplayName,
  selectedQuizId,
  setSelectedQuizId,
  hostRole,
  setHostRole,
  advanceMode,
  setAdvanceMode,
  questionTimeLimit,
  setQuestionTimeLimit,
  activeSessions,
  loadingSessions,
  setSession,
  setViewMode,
  refreshSessionState,
  setIsLoading,
  fetchActiveSessions,
  debugMode,
  setDebugMode,
  resetView,
  toast
}) => {
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [useCustomQuestions, setUseCustomQuestions] = useState(false);
  const [customQuestions, setCustomQuestions] = useState([{
    question_text: '',
    options: ['', ''],
    correct_answer: 0,
    explanation: '',
    time_limit: 30,
  }]);
  // Quiz mode state
  const [quizMode, setQuizMode] = useState<'synchronized' | 'individual_auto'>('synchronized');
  const [scheduledStart, setScheduledStart] = useState<string>('');
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);
  
  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [creationMode, setCreationMode] = useState<'host' | 'join' | null>(null);

  // Available sessions to join
  const [availableToJoin, setAvailableToJoin] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedPublicSession, setSelectedPublicSession] = useState<any | null>(null);

  useEffect(() => {
    if (creationMode === 'join') {
      const load = async () => {
        setLoadingAvailable(true);
        const sessions = await getAvailableSessions();
        setAvailableToJoin(sessions);
        setLoadingAvailable(false);
      };
      load();
    } else {
        setSelectedPublicSession(null);
    }
  }, [creationMode]);

  useEffect(() => {
    if (quizMode === 'individual_auto' && advanceMode !== 'auto') {
      setAdvanceMode('auto');
    }
  }, [quizMode, advanceMode, setAdvanceMode]);

  const blankQuestion = () => ({
    question_text: '',
    options: ['', ''],
    correct_answer: 0,
    explanation: '',
    time_limit: questionTimeLimit,
  });

  const addCustomQuestion = () => setCustomQuestions(qs => [...qs, blankQuestion()]);
  const removeCustomQuestion = (idx: number) => setCustomQuestions(qs => qs.length > 1 ? qs.filter((_, i) => i !== idx) : qs);
  const updateCustomQuestion = (idx: number, field: string, value: any) => setCustomQuestions(qs => {
    const copy = [...qs];
    copy[idx] = { ...copy[idx], [field]: value };
    return copy;
  });
  const updateCustomOption = (qIdx: number, optIdx: number, value: string) => setCustomQuestions(qs => {
    const copy = [...qs];
    copy[qIdx].options[optIdx] = value;
    return copy;
  });
  const addCustomOption = (qIdx: number) => setCustomQuestions(qs => {
    const copy = [...qs];
    copy[qIdx].options.push('');
    return copy;
  });
  const removeCustomOption = (qIdx: number, optIdx: number) => setCustomQuestions(qs => {
    const copy = [...qs];
    if (copy[qIdx].options.length > 2) copy[qIdx].options.splice(optIdx, 1);
    return copy;
  });

  const handleRejoinSession = async (sessionData: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await rejoinSession(sessionData);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.session) {
        throw new Error('Failed to rejoin session');
      }

      setSession(result.session);
      
      if (result.session.status === 'waiting') {
        setViewMode(result.session.host_user_id === userId ? 'host-lobby' : 'participant-lobby');
      } else if (result.session.status === 'in_progress') {
        setViewMode('quiz-active');
      } else if (result.session.status === 'completed') {
        setViewMode('results');
      }

      toast({ 
        title: 'Rejoined Successfully!', 
        description: `Welcome back to the quiz!` 
      });
    } catch (err: any) {
      // console.error('Error rejoining session:', err);
      const errorMessage = err.message || 'Failed to rejoin session';
      setError(errorMessage);
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
      
      setTimeout(() => resetView(), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveSession = async (sessionId: string) => {
    setIsLoading(true);
    
    try {
      const result = await leaveQuizSession(sessionId, userId);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({ 
        title: 'Left Session', 
        description: 'You have left the quiz session' 
      });

      await fetchActiveSessions();
    } catch (err: any) {
      // console.error('Error leaving session:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to leave session', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleHostQuiz = async () => {
    if (!useCustomQuestions && !selectedQuizId) {
      setError('Please select a quiz or use custom questions');
      toast({
        title: 'Error',
        description: 'Please select a quiz or use custom questions',
        variant: 'destructive',
      });
      return;
    }

    // Validate custom questions
    if (useCustomQuestions) {
      for (const [i, q] of customQuestions.entries()) {
        if (!q.question_text.trim() || q.options.some(opt => !opt.trim()) || q.options.length < 2) {
          setError(`Fill all fields for question ${i + 1} (min 2 options)`);
          toast({ 
            title: 'Error', 
            description: `Fill all fields for question ${i + 1} (min 2 options)`, 
            variant: 'destructive' 
          });
          return;
        }
      }
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure selectedQuizId is a UUID, not a quiz title
      let quizIdToSend = selectedQuizId;
      // UUID v4 regex (simple check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!useCustomQuestions && selectedQuizId && !uuidRegex.test(selectedQuizId)) {
        // Try to find the quiz by title and get its id
        const foundQuiz = quizzes.find(q => q.title === selectedQuizId);
        if (foundQuiz) quizIdToSend = foundQuiz.id;
      }
      const result = await createLiveQuizSession(
        useCustomQuestions ? undefined : quizIdToSend,
        useCustomQuestions ? customQuestions : undefined,
        hostRole,
        advanceMode,
        questionTimeLimit,
        quizMode,
        scheduledStart ? new Date(scheduledStart) : null,
        allowLateJoin
      );

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.session) {
        throw new Error('Failed to create session');
      }

      setSession(result.session);
      setViewMode('host-lobby');
      
      setTimeout(() => refreshSessionState(), 500);

      toast({ 
        title: 'Session Created!', 
        description: `Join code: ${result.joinCode}`,
        duration: 5000,
      });
    } catch (err: any) {
      // console.error('Error creating session:', err);
      const errorMessage = err.message || 'Failed to create session';
      setError(errorMessage);
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinQuiz = async () => {
    if (!joinCode.trim() || !displayName.trim()) {
      setError('Please enter both join code and display name');
      toast({
        title: 'Error',
        description: 'Please enter both join code and display name',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await joinLiveQuizSession(joinCode, displayName);

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.session) {
        throw new Error('Session not found or already started');
      }

      // Verify if the joined session matches the selected public session (if any)
      if (selectedPublicSession && result.session.id !== selectedPublicSession.id) {
          throw new Error('The entered code does not match the selected quiz.');
      }

      setSession(result.session);
      
      // Check if the joining user is the host
      const isHost = result.session.host_user_id === userId;
      setViewMode(isHost ? 'host-lobby' : 'participant-lobby');
      
      setTimeout(() => refreshSessionState(), 500);

      toast({ 
        title: 'Joined Successfully!', 
        description: `Welcome to the quiz, ${displayName}!` 
      });
    } catch (err: any) {
      // console.error('Error joining session:', err);
      let errorMessage = err.message || 'Failed to join session';
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.toLowerCase().includes('session not found')) {
        errorMessage = 'Live quiz not found. Please check the join code and try again.';
      } else if (errorMessage.includes('already started') || errorMessage.includes('in progress')) {
        errorMessage = 'This quiz has already started and cannot accept new players.';
      }
      
      setError(errorMessage);
      toast({ 
        title: 'Quiz not found', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const menuContent = (
    <div className={isFullScreen ? "max-w-4xl mx-auto space-y-6 relative z-10" : "max-w-4xl mx-auto space-y-6"}>
      {/* Debug Button */}
      {process.env.NODE_ENV === 'development' && (
        <Button
          onClick={() => setDebugMode(!debugMode)}
          variant="ghost"
          size="sm"
          className="fixed bottom-4 left-4 z-50"
        >
          🐛 Debug
        </Button>
      )}

      {/* Debug Panel */}
      {debugMode && (
        <Card className="fixed bottom-20 left-4 w-96 z-50 max-h-80 overflow-auto bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-xs">
              {JSON.stringify({
                activeSessions,
                isLoading,
                userId
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions Section */}
      {activeSessions.length > 0 && (
        <Card className={
             isFullScreen 
             ? "bg-white/60 dark:bg-black/40 border-amber-500/30 text-gray-900 dark:text-white backdrop-blur-md shadow-lg mb-6" 
             : "rounded-2xl border-2 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className={isFullScreen ? "h-5 w-5 text-amber-500 dark:text-amber-400" : "h-5 w-5 text-amber-500"} />
              Your Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="text-center py-4">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-amber-500" />
                <p className={isFullScreen ? "text-sm text-gray-500 dark:text-gray-300" : "text-sm text-gray-600 dark:text-gray-400"}>Loading sessions...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((sessionData) => (
                  <div
                    key={sessionData.id}
                    className={
                        isFullScreen
                        ? "p-4 bg-white/50 dark:bg-white/5 rounded-lg border border-amber-500/20 shadow-sm"
                        : "p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-amber-200 dark:border-amber-700 shadow-sm"
                    }
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={sessionData.status === 'waiting' ? 'secondary' : 'default'}
                            className={
                                isFullScreen
                                ? (sessionData.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 border-yellow-500/30' : 'bg-green-500/20 text-green-700 dark:text-green-200 border-green-500/30')
                                : (sessionData.status === 'waiting' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100')
                            }
                          >
                            {sessionData.status === 'waiting' ? 'Waiting' : 'In Progress'}
                          </Badge>
                          {sessionData.player_info.is_host && (
                            <Badge variant="secondary" className={isFullScreen ? "bg-blue-500/20 text-blue-700 dark:text-blue-200 border-blue-500/30" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"}>
                              <Crown className="h-3 w-3 mr-1" />
                              Host
                            </Badge>
                          )}
                          {sessionData.player_info.is_host && !sessionData.player_info.is_playing && (
                            <Badge variant="secondary" className={isFullScreen ? "bg-blue-500/20 text-blue-700 dark:text-blue-200 border-blue-500/30" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"}>
                              <UserCog className="h-3 w-3 mr-1" />
                              Mediator
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 text-sm ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>
                            <span className="font-semibold">Join Code:</span>
                            <span className="font-mono font-bold text-lg">{sessionData.join_code}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(sessionData.join_code);
                                toast({ title: 'Copied!', description: 'Join code copied to clipboard' });
                              }}
                              className={isFullScreen ? "p-1 h-auto text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10" : "p-1 h-auto"}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className={`flex items-center gap-2 text-sm ${isFullScreen ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                            <Users className="h-4 w-4" />
                            <span>Playing as: {sessionData.player_info.display_name}</span>
                          </div>
                          {sessionData.status === 'in_progress' && (
                            <div className={`flex items-center gap-2 text-sm ${isFullScreen ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                              <Zap className="h-4 w-4 text-yellow-500" />
                              <span>Score: {sessionData.player_info.score}</span>
                            </div>
                          )}
                          {sessionData.host_role && (
                            <div className={`flex items-center gap-2 text-sm ${isFullScreen ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                              <Settings className="h-4 w-4" />
                              <span>Mode: {sessionData.host_role === 'mediator' ? 'Mediator' : 'Participant'} • {sessionData.advance_mode === 'auto' ? 'Auto' : 'Manual'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleRejoinSession(sessionData)}
                        disabled={isLoading}
                        className={isFullScreen ? "flex-1 bg-amber-600 hover:bg-amber-500 text-white" : "flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Rejoining...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            {sessionData.status === 'waiting' ? 'Rejoin Lobby' : 'Continue Quiz'}
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleLeaveSession(sessionData.id)}
                        disabled={isLoading}
                        variant="outline"
                        className={isFullScreen ? "border-red-400/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" : "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"}
                      >
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
      )}


      <Card className={isFullScreen ? "bg-transparent border-none shadow-none w-full" : "rounded-2xl border-2 shadow-lg overflow-hidden"}>
        {!isFullScreen && (
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Live Quiz Creator
              </CardTitle>
              <CardDescription className="text-blue-100">
                {creationMode === null && "Choose how you want to participate"}
                {creationMode === 'host' && `Step ${currentStep} of 3: Configure your quiz`}
                {creationMode === 'join' && "Join an existing quiz"}
              </CardDescription>
            </div>
            {creationMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreationMode(null);
                  setCurrentStep(1);
                }}
                className="text-white hover:bg-white/20"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
        </CardHeader>
        )}
        
        <CardContent className={isFullScreen ? "p-0" : "p-6"}>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AnimatePresence mode="wait">
            {/* Step 0: Choose Mode */}
            {!creationMode && (
              <motion.div
                key="mode-selection"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreationMode('host')}
                    className={`p-6 rounded-xl border-2 text-left group transition-all ${
                      isFullScreen 
                        ? 'bg-white/60 dark:bg-black/40 border-white/10 dark:hover:border-blue-500/50 hover:bg-white/80 dark:hover:bg-black/60 hover:shadow-lg backdrop-blur-md' 
                        : 'border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg text-white group-hover:scale-110 transition-transform ${isFullScreen ? 'bg-blue-600' : 'bg-blue-500'}`}>
                        <Crown className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className={isFullScreen ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'}>
                        Host
                      </Badge>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${isFullScreen ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                      Host a Quiz
                    </h3>
                    <p className={`text-sm ${isFullScreen ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      Create and manage a live quiz session. Choose questions, set rules, and lead your participants.
                    </p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCreationMode('join')}
                    className={`p-6 rounded-xl border-2 text-left group transition-all ${
                        isFullScreen 
                          ? 'bg-white/60 dark:bg-black/40 border-white/10 dark:hover:border-purple-500/50 hover:bg-white/80 dark:hover:bg-black/60 hover:shadow-lg backdrop-blur-md' 
                          : 'border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-blue-900/20 dark:to-pink-900/20'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg text-white group-hover:scale-110 transition-transform ${isFullScreen ? 'bg-purple-600' : 'bg-blue-500'}`}>
                        <UserPlus className="h-6 w-6" />
                      </div>
                      <Badge variant="secondary" className={isFullScreen ? 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'}>
                        Join
                      </Badge>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${isFullScreen ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                      Join a Quiz
                    </h3>
                    <p className={`text-sm ${isFullScreen ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      Enter a join code to participate in an existing live quiz session with others.
                    </p>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Join Mode */}
            {creationMode === 'join' && (
              <motion.div
                key="join-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className={
                    isFullScreen 
                    ? "bg-white/60 dark:bg-black/40 border-white/10 backdrop-blur-md text-gray-900 dark:text-white shadow-xl"
                    : "bg-gradient-to-br from-blue-50 to-pink-50 dark:from-blue-900/20 dark:to-pink-900/20 border-blue-200 dark:border-blue-800"
                }>
                  <CardContent className="p-6 space-y-4">
                    {/* Fullscreen Back Button */}
                    {isFullScreen && (
                         <div className="flex justify-start mb-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white pl-0 hover:bg-transparent"
                                onClick={() => setCreationMode(null)}
                            >
                                <ArrowRight className="h-4 w-4 mr-2 rotate-180" /> Back to Menu
                            </Button>
                         </div>
                    )}

                    <div>
                      <Label htmlFor="displayName" className={`text-sm font-medium mb-2 block ${isFullScreen ? 'text-gray-700 dark:text-gray-300' : ''}`}>
                        Your Display Name
                      </Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        className={isFullScreen ? "text-lg bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/30 focus-visible:ring-blue-500" : "text-lg"}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="joinCode" className={`text-sm font-medium mb-2 block ${isFullScreen ? 'text-gray-700 dark:text-gray-300' : ''}`}>
                        {selectedPublicSession ? `Enter Code for "${selectedPublicSession.quizzes?.title || 'Selected Quiz'}"` : 'Join Code'}
                      </Label>
                      <div className="relative">
                          <Input
                            id="joinCode"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder={selectedPublicSession ? "ENTER CODE TO VERIFY" : "X7Y9Z"}
                            maxLength={6}
                            className={isFullScreen ? "text-2xl font-mono text-center tracking-widest bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/30 focus-visible:ring-blue-500 uppercase" : "text-2xl font-mono text-center tracking-widest"}
                          />
                          {selectedPublicSession && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setSelectedPublicSession(null);
                                    setJoinCode('');
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"
                              >
                                  <X className="h-4 w-4" />
                              </Button>
                          )}
                      </div>
                      <p className={`text-xs mt-1 ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>
                        {selectedPublicSession ? "The host has provided this code. Enter it to confirm access." : "Enter the 6-character code from your host"}
                      </p>
                    </div>

                    <Button
                      onClick={handleJoinQuiz}
                      disabled={isLoading || !joinCode.trim() || !displayName.trim()}
                      className={`w-full py-6 text-lg ${isFullScreen ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white'}`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          {selectedPublicSession ? 'Verifying...' : 'Joining...'}
                        </>
                      ) : (
                        <>
                          <Radio className="h-5 w-5 mr-2" />
                          {selectedPublicSession ? 'Verify & Join' : 'Join Quiz'}
                        </>
                      )}
                    </Button>

                    {/* Public Sessions List */}
                    {!selectedPublicSession && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <h4 className={`text-sm font-medium mb-3 ${isFullScreen ? 'text-gray-300' : 'text-gray-700'}`}>
                        Or select a public quiz:
                      </h4>
                      {loadingAvailable ? (
                        <div className="text-center py-4">
                          <Loader2 className="h-5 w-5 mx-auto animate-spin text-white/50" />
                        </div>
                      ) : availableToJoin.length === 0 ? (
                        <p className={`text-xs text-center italic ${isFullScreen ? "text-white/30" : "text-gray-500 dark:text-gray-400"}`}>No public quizzes currently waiting.</p>
                      ) : (
                        <ScrollArea className={`h-[200px] w-full rounded-md border p-2 ${
                            isFullScreen 
                            ? "bg-black/20 border-white/10" 
                            : "bg-white/50 dark:bg-black/20 border-gray-200 dark:border-gray-700"
                        }`}>
                           <div className="space-y-2">
                              {availableToJoin.map((session) => (
                                <button
                                  key={session.id}
                                  onClick={() => {
                                      setSelectedPublicSession(session);
                                      setJoinCode(''); // Clear existing code to force entry
                                  }}
                                  className={`w-full p-3 rounded-lg text-left transition flex items-center justify-between group ${
                                      isFullScreen 
                                      ? "bg-white/40 dark:bg-white/5 hover:bg-blue-600 dark:hover:bg-white/10 text-gray-900 dark:text-white hover:text-white border border-transparent" 
                                      : "bg-white hover:bg-blue-50 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white border border-gray-100 dark:border-transparent"
                                  }`}
                                >
                                   <div>
                                      <div className="font-bold">{session.quizzes?.title || 'Live Quiz'}</div>
                                      <div className={`text-xs ${isFullScreen ? "text-gray-500 group-hover:text-blue-100 dark:text-white/50" : "text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-white/70"}`}>Host ID: {session.host_user_id.slice(0, 8)}...</div>
                                   </div>
                                   <div className={`opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all ${isFullScreen ? "text-white" : "text-blue-500"}`}>
                                      <ArrowRight className="h-4 w-4" />
                                   </div>
                                </button>
                              ))}
                           </div>
                        </ScrollArea>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Host Mode - Step 1: Quiz Selection */}
            {creationMode === 'host' && currentStep === 1 && (
              <motion.div
                key="host-step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className={
                    isFullScreen 
                    ? "bg-white/60 dark:bg-black/40 border-white/10 backdrop-blur-md text-gray-900 dark:text-white shadow-xl"
                    : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800"
                }>
                  <CardHeader>
                    {/* Fullscreen Back Action */}
                    {isFullScreen && (
                         <div className="flex justify-start -ml-2 -mt-2 mb-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white pl-2 hover:bg-transparent"
                                onClick={() => setCreationMode(null)}
                            >
                                <ArrowRight className="h-4 w-4 mr-2 rotate-180" /> Back to Menu
                            </Button>
                         </div>
                    )}
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Trophy className={`h-5 w-5 ${isFullScreen ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-500'}`} />
                      Choose Your Questions
                    </CardTitle>
                    <CardDescription className={isFullScreen ? "text-gray-600 dark:text-gray-300" : ""}>
                      Select an existing quiz or create custom questions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Tabs defaultValue="existing" className="w-full">
                      <TabsList className={`grid w-full grid-cols-2 ${isFullScreen ? 'bg-black/5 dark:bg-white/10' : ''}`}>
                        <TabsTrigger 
                            value="existing" 
                            onClick={() => setUseCustomQuestions(false)}
                            className={isFullScreen ? "data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-700 dark:text-gray-300" : ""}
                        >
                          Existing Quiz
                        </TabsTrigger>
                        <TabsTrigger 
                            value="custom" 
                            onClick={() => setUseCustomQuestions(true)}
                            className={isFullScreen ? "data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-700 dark:text-gray-300" : ""}
                        >
                          Custom Questions
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="existing" className="mt-4">
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2 pr-4">
                            {quizzes
                              .filter(q => q.questions && q.questions.length > 0)
                              .map((quiz) => (
                                <motion.button
                                  key={quiz.id}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setSelectedQuizId(quiz.id)}
                                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                                    isFullScreen
                                      ? selectedQuizId === quiz.id
                                        ? 'border-blue-500 bg-blue-500/20 text-blue-900 dark:text-white'
                                        : 'border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:border-blue-400/50 hover:bg-black/10 dark:hover:bg-white/10'
                                      : selectedQuizId === quiz.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                  }`}
                                >
                                  <div className={`font-semibold ${isFullScreen ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                                    {quiz.title}
                                  </div>
                                  <div className={`text-sm mt-1 ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>
                                    {quiz.questions?.length || 0} questions
                                  </div>
                                </motion.button>
                              ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="custom" className="mt-4">
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-3 pr-4">
                            {customQuestions.map((q, qIdx) => (
                              <Card key={qIdx} className={isFullScreen ? "bg-white/40 dark:bg-black/20 border-black/5 dark:border-white/10" : ""}>
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <span className={`font-semibold ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Q{qIdx + 1}</span>
                                    {customQuestions.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeCustomQuestion(qIdx)}
                                        className={isFullScreen ? "text-red-600 dark:text-red-400 hover:bg-red-500/20" : ""}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                  <Input
                                    placeholder="Question text"
                                    value={q.question_text}
                                    onChange={(e) => updateCustomQuestion(qIdx, 'question_text', e.target.value)}
                                    className={isFullScreen ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white" : ""}
                                  />
                                  <div className="space-y-2">
                                    {q.options.map((opt, optIdx) => (
                                      <div key={optIdx} className="flex gap-2">
                                        <Input
                                          placeholder={`Option ${optIdx + 1}`}
                                          value={opt}
                                          onChange={(e) => updateCustomOption(qIdx, optIdx, e.target.value)}
                                          className={isFullScreen ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white" : ""}
                                        />
                                        {q.options.length > 2 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeCustomOption(qIdx, optIdx)}
                                            className={isFullScreen ? "text-red-600 dark:text-red-400 hover:bg-red-500/20" : ""}
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addCustomOption(qIdx)}
                                    className={`w-full ${isFullScreen ? "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/20 text-gray-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/10" : ""}`}
                                  >
                                    Add Option
                                  </Button>
                                  <select
                                    value={q.correct_answer}
                                    onChange={(e) => updateCustomQuestion(qIdx, 'correct_answer', parseInt(e.target.value))}
                                    className={`w-full p-2 border rounded-lg ${
                                        isFullScreen 
                                        ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white" 
                                        : "bg-white dark:bg-gray-900 dark:border-gray-700 text-gray-900 dark:text-white"
                                    }`}
                                  >
                                    {q.options.map((opt, i) => (
                                      <option key={i} value={i} className={isFullScreen ? "bg-white dark:bg-slate-800" : "bg-white dark:bg-gray-900"}>Correct Answer: Option {i + 1}</option>
                                    ))}
                                  </select>
                                </CardContent>
                              </Card>
                            ))}
                            <Button
                              variant="outline"
                              onClick={addCustomQuestion}
                              className={`w-full ${isFullScreen ? "bg-black/5 dark:bg-white/5 border-black/20 dark:border-white/20 text-gray-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/10" : ""}`}
                            >
                              Add Question
                            </Button>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>

                    <Button
                      onClick={() => setCurrentStep(2)}
                      disabled={!useCustomQuestions && !selectedQuizId}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      Next: Configure Settings
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Host Mode - Step 2: Settings */}
            {creationMode === 'host' && currentStep === 2 && (
              <motion.div
                key="host-step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className={
                    isFullScreen 
                    ? "bg-white/60 dark:bg-black/40 border-white/10 backdrop-blur-md text-gray-900 dark:text-white shadow-xl max-h-[75vh] overflow-y-auto custom-scrollbar"
                    : ""
                }>
                  <CardHeader>
                    {/* Fullscreen Back Action */}
                    {isFullScreen && (
                         <div className="flex justify-start -ml-2 -mt-2 mb-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white pl-2 hover:bg-transparent"
                                onClick={() => setCurrentStep(1)}
                            >
                                <ArrowRight className="h-4 w-4 mr-2 rotate-180" /> Back to Questions
                            </Button>
                         </div>
                    )}
                    <CardTitle className="flex items-center gap-2">
                      <Settings className={`h-5 w-5 ${isFullScreen ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500'}`} />
                      Quiz Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Host Role */}
                    <div>
                      <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>Your Role</Label>
                      <RadioGroup value={hostRole} onValueChange={(v) => setHostRole(v as 'participant' | 'mediator')}>
                        <div className="space-y-3">
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="participant" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Play as Participant</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Host can also answer questions and compete</div>
                            </div>
                          </Label>
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="mediator" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Mediator Only</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Host moderates but doesn't answer questions</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Advance Mode */}
                    <div>
                      <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>Advance Mode</Label>
                      <RadioGroup value={advanceMode} onValueChange={(v) => setAdvanceMode(v as 'auto' | 'manual')} disabled={quizMode === 'individual_auto'}>
                        <div className="space-y-3">
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="auto" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Auto Advance</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Questions advance automatically when time expires</div>
                            </div>
                          </Label>
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="manual" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Manual Advance</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Host controls when to move to next question</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Quiz Mode */}
                    <div>
                      <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>Quiz Mode</Label>
                      <RadioGroup value={quizMode} onValueChange={(v) => setQuizMode(v as 'synchronized' | 'individual_auto')}>
                        <div className="space-y-3">
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="synchronized" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Synchronized Mode</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Everyone answers the same question at the same time</div>
                            </div>
                          </Label>
                          <Label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                              isFullScreen 
                                ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-50 dark:data-[state=checked]:bg-blue-500/10' 
                                : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>
                            <RadioGroupItem value="individual_auto" className={isFullScreen ? "border-gray-400 dark:border-white/50 text-blue-500" : ""} />
                            <div>
                              <div className={`font-medium ${isFullScreen ? 'text-gray-900 dark:text-white' : ''}`}>Individual Auto Mode</div>
                              <div className={`text-sm ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Each participant progresses at their own pace</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Time Limit */}
                    <div>
                      <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>
                        Question Time Limit: {questionTimeLimit} seconds
                      </Label>
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        value={questionTimeLimit}
                        onChange={(e) => setQuestionTimeLimit(parseInt(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isFullScreen ? 'bg-black/10 dark:bg-white/20 accent-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                      />
                      <div className={`flex justify-between text-xs mt-2 ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>
                        <span>10s</span>
                        <span>60s</span>
                        <span>120s</span>
                      </div>
                    </div>

                    {/* Scheduled Start & Late Join */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                         <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>Scheduled Start (Optional)</Label>
                         <Input 
                            type="datetime-local" 
                            value={scheduledStart} 
                            onChange={(e) => setScheduledStart(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className={`w-full ${isFullScreen ? 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white scheme-light dark:scheme-dark' : ''}`}
                         />
                         <p className={`text-xs mt-1 ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Leave blank to start manually</p>
                      </div>
                      
                      <div>
                         <Label className={`text-base font-semibold mb-3 block ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>Visibility & Access</Label>
                         <div className={`flex items-center space-x-2 border p-3 rounded-lg transition-colors ${
                             isFullScreen 
                             ? 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5' 
                             : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                         }`}>
                           <input
                             type="checkbox"
                             id="allowLateJoin"
                             checked={!allowLateJoin}
                             onChange={(e) => setAllowLateJoin(!e.target.checked)}
                             className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                           />
                           <label htmlFor="allowLateJoin" className={`text-sm font-medium leading-none cursor-pointer flex-1 ${isFullScreen ? 'text-gray-700 dark:text-gray-200' : ''}`}>
                             Private Session<br/>
                             <span className={`text-xs font-normal ${isFullScreen ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>Hide from public list & reject late joiners</span>
                           </label>
                         </div>
                      </div>
                    </div>

                    {!isFullScreen && (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleHostQuiz}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Create Quiz Session
                          </>
                        )}
                      </Button>
                    </div>
                    )}
                    {isFullScreen && (
                      <Button
                        onClick={handleHostQuiz}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 py-6 text-lg"
                      >
                         {isLoading ? "Creating..." : "Launch Quiz Session"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white overflow-hidden flex flex-col transition-colors duration-300">
        {/* Immersive Background */}
        <div className="absolute inset-0 z-0 opacity-40 dark:opacity-40">
           <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/herobackgroundimg.png')" }} />
           <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/80 backdrop-blur-sm" />
        </div>

        {/* Top Bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-blue-600/90 dark:bg-black/20 backdrop-blur-md border-b border-white/10 shrink-0 shadow-lg dark:shadow-none">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/20 dark:bg-blue-500/20 rounded-lg shadow-inner">
                <Sparkles className="h-6 w-6 text-white dark:text-blue-400" />
             </div>
             <div>
               <h1 className="font-bold text-xl leading-none text-white dark:text-white">VisioQuiz Setup</h1>
               <p className="text-xs text-blue-100 dark:text-white/50">Configure your session</p>
             </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFullScreen(false)}
            className="text-white/80 dark:text-white/70 hover:text-white dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10"
          >
            <Minimize2 className="h-4 w-4 mr-2" />
            Exit Fullscreen
          </Button>
        </div>

        {/* Content Area */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
            {menuContent}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={() => setIsFullScreen(true)}>
          <Maximize2 className="h-4 w-4 mr-2" />
          Fullscreen
        </Button>
      </div>
      {menuContent}
    </div>
  );
};

export default LiveQuizMenu;
