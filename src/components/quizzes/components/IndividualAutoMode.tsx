

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ArrowLeft, ArrowRight, Clock, Maximize, Minimize } from 'lucide-react';
import { toast } from 'sonner';
import QuestionList from './QuestionList';
import ProgressTracker from './ProgressTracker';
import IndividualLeaderboard from './IndividualLeaderboard';
import { getIndividualQuizState, submitAnswerIndividual, advanceIndividual } from '@/services/liveQuizService';

// Props: sessionId, playerId
interface IndividualAutoModeProps {
  sessionId: string;
  playerId: string;
}

const IndividualAutoMode: React.FC<IndividualAutoModeProps> = ({ sessionId, playerId }) => {
  const [quizState, setQuizState] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [questionEntryTime, setQuestionEntryTime] = useState<number>(Date.now());
  const [localStartTime, setLocalStartTime] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Fetch quiz state on mount and when sessionId/playerId changes
  useEffect(() => {
    const fetchState = async () => {
      setLoading(true);
      try {
        const state = await getIndividualQuizState(sessionId, playerId);
        if (!state) {
          // console.error('Failed to fetch individual quiz state for session:', sessionId, 'player:', playerId);
          setLoading(false);
          // Don't auto-reload, it might cause loops. Just show error.
          return;
        }
        setQuizState(state);
        
        // Initialize local start time for self-paced mode
        const storageKey = `studdyhub_quiz_start_${sessionId}_${playerId}`;
        const storedStart = localStorage.getItem(storageKey);
        
        if (storedStart) {
            setLocalStartTime(parseInt(storedStart, 10));
        } else {
            // New start
            const now = Date.now();
            localStorage.setItem(storageKey, now.toString());
            setLocalStartTime(now);
        }

        if (state) setLeaderboard(state.leaderboard || []);
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, [sessionId, playerId]);

  // Keep currentQuestionIndex in range if questions change
  useEffect(() => {
    if (!quizState?.questions?.length) return;
    setCurrentQuestionIndex((idx) => Math.min(idx, quizState.questions.length - 1));
  }, [quizState?.questions?.length]);

  // Calculate Total Time
  const calculateTotalTime = () => {
    if (!quizState?.questions) return 300; // Default to 5 mins if no questions yet
    return quizState.questions.reduce((acc: number, q: any) => acc + (q.time_limit || 30), 0);
  };

  // Timer logic (Global - Self Paced)
  useEffect(() => {
    // We need both the questions (for total time) and the start time
    if (!quizState?.questions || !localStartTime) return;

    const totalSeconds = calculateTotalTime();
    
    // For Individual Auto Mode, start time is when the USER started (localStartTime),
    // NOT when the session was created (session.started_at).
    // This allows users to join anytime and get the full duration.
    const startTime = localStartTime; 

    // Initialize timer immediately to avoid 0 flash
    const initialElapsed = Math.floor((Date.now() - startTime) / 1000);
    const initialRemaining = Math.max(0, totalSeconds - initialElapsed);
    setTimer(initialRemaining);

    const updateTimer = () => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const remaining = totalSeconds - elapsedSeconds;

      if (elapsedSeconds < 0) {
          // Time in future? Should rarely happen with local start
          setTimer(totalSeconds);
          return;
      }

      if (remaining <= 0) {
        setTimer(0);
        // Time is up!
      } else {
        setTimer(remaining);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [localStartTime, quizState?.questions]); // Depend on localStartTime instead of session.started_at


  // Track entry time for questions
  useEffect(() => {
      setQuestionEntryTime(Date.now());
  }, [currentQuestionIndex]);

  // Handle answer submission
  const handleSubmit = async () => {
    if (!quizState || submitting) return;
    setSubmitting(true);
    const questions = quizState.questions || [];
    const current = questions[currentQuestionIndex];
    if (!current) return;
    
    // Calculate time spent on this specific question instance
    const spent = Math.max(0, (Date.now() - questionEntryTime) / 1000);
    
    try {
        const result = await submitAnswerIndividual({
            sessionId,
            playerId,
            questionId: current.id,
            questionIndex: currentQuestionIndex,
            selectedOption: selectedOption ?? -1,
            timeSpent: spent,
        });

        if (result.success) {
             toast.success("Answer saved");
             // Refresh to update progress indicators
             const state = await getIndividualQuizState(sessionId, playerId);
             setQuizState(state);
        } else {
             // console.error("Submission failed:", result.error);
             toast.error(`Failed to save answer: ${result.error || 'Unknown error'}`);
        }
    } catch (err: any) {
        console.error("Submission error", err);
        toast.error("Failed to save answer");
    } finally {
        setSubmitting(false);
    }
  };
  
  // Just navigation
  const handleNext = () => {
     if (currentQuestionIndex < (quizState?.questions?.length || 0) - 1) {
         setCurrentQuestionIndex(prev => prev + 1);
         setSelectedOption(null);
     }
  };
  
  const handlePrev = () => {
      if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(prev => prev - 1);
          setSelectedOption(null);
      }
  };
  
  // Handle local selection sync with saved progress
  useEffect(() => {
      if (quizState && quizState.questions) {
          const currentQ = quizState.questions[currentQuestionIndex];
          if (currentQ) {
              const progress = quizState.playerProgress?.find((p: any) => p.question_id === currentQ.id);
              if (progress?.status === 'answered' && typeof progress.selected_option === 'number') {
                  setSelectedOption(progress.selected_option);
              } else {
                  setSelectedOption(null);
              }
          }
      }
  }, [currentQuestionIndex, quizState]);

  if (loading || !quizState) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-sm text-gray-500">Loading quiz...</CardContent>
        </Card>
      </div>
    );
  }

  const questions = quizState.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-sm text-gray-500">Loading question...</CardContent>
        </Card>
      </div>
    );
  }
  const playerProgress = quizState.playerProgress;
  const totalQuestions = questions.length;

  return (
    <div 
        ref={containerRef} 
        className={`w-full mx-auto space-y-4 animate-in fade-in duration-500 bg-background ${isFullscreen ? 'p-6 max-w-none h-screen overflow-y-auto' : 'max-w-7xl'}`}
    >
      {/* Top Bar: Progress & Time */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
             <div className="flex items-center gap-3">
                 <Badge variant="secondary" className="px-3 py-1 text-sm">
                    Question {currentQuestionIndex + 1} / {totalQuestions}
                 </Badge>
                 <div className="h-4 w-px bg-border hidden sm:block"></div>
                 <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {timer > 0 ? (
                        <span className="text-blue-600 font-mono text-base">{Math.floor(timer / 60)}m {timer % 60}s</span>
                    ) : (
                        <span className="text-red-500 font-bold">Time Expired</span>
                    )}
                 </div>
             </div>
             
             {/* Full screen toggle (mobile/desktop) */}
             <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleFullscreen}
                className="ml-2 text-muted-foreground hover:text-foreground"
                title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
             >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
             </Button>
        </div>
        <ProgressTracker current={currentQuestionIndex + 1} total={totalQuestions} className="w-full sm:w-1/3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Question Area */}
        <div className="lg:col-span-8 xl:col-span-9 order-1">
          <Card className="h-full flex flex-col border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="pb-6 border-b bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-xl sm:text-2xl leading-relaxed font-medium text-slate-800 dark:text-slate-100">
                {currentQuestion.question_text}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-6 md:p-8">
              <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
                {currentQuestion.options.map((opt: string, idx: number) => (
                  <Button
                    key={idx}
                    type="button"
                    variant={selectedOption === idx ? 'default' : 'outline'}
                    className={`justify-start whitespace-normal text-left h-auto py-4 px-6 text-base transition-all duration-200 ${
                        selectedOption === idx 
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-md transform scale-[1.01]' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedOption(idx)}
                    disabled={submitting}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full mr-4 text-sm font-bold flex-shrink-0 transition-colors ${
                        selectedOption === idx 
                        ? 'bg-white text-blue-600' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-white'
                    }`}>
                        {String.fromCharCode(65 + idx)}
                    </div>
                    {opt}
                  </Button>
                ))}
              </div>
            </CardContent>
            
            <CardFooter className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t flex items-center justify-between gap-4 sticky bottom-0 backdrop-blur-sm z-10">
                 <Button 
                    variant="ghost" 
                    onClick={handlePrev} 
                    disabled={currentQuestionIndex === 0}
                    className="hover:bg-white dark:hover:bg-slate-800"
                 >
                    <ArrowLeft className="w-4 h-4 mr-2"/> Previous
                 </Button>
                 
                 <Button 
                    onClick={handleSubmit} 
                    disabled={submitting || selectedOption === null || timer <= 0}
                    className="min-w-[140px] shadow-lg shadow-blue-500/20"
                    size="lg"
                 >
                    {submitting ? 'Saving...' : (currentQuestionIndex === (totalQuestions - 1) ? 'Submit Quiz' : 'Save Answer')}
                 </Button>

                 <Button 
                    variant="ghost" 
                    onClick={handleNext} 
                    disabled={currentQuestionIndex === (totalQuestions - 1)}
                    className="hover:bg-white dark:hover:bg-slate-800"
                 >
                    Next <ArrowRight className="w-4 h-4 ml-2"/>
                 </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Sidebar - Tools */}
        <div className="lg:col-span-4 xl:col-span-3 order-2 space-y-6">
             <Tabs defaultValue="questions" className="w-full">
                <TabsList className="w-full grid grid-cols-2 mb-4">
                    <TabsTrigger value="questions">Map</TabsTrigger>
                    <TabsTrigger value="leaderboard">Rank</TabsTrigger>
                </TabsList>
                
                <TabsContent value="questions" className="mt-0">
                     <Card className="border-0 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Question Map</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                             <div className="p-4">
                                <QuestionList
                                    questions={quizState.questions}
                                    playerProgress={playerProgress}
                                    currentQuestionIndex={currentQuestionIndex}
                                    onSelectQuestion={setCurrentQuestionIndex}
                                />
                            </div>
                        </CardContent>
                     </Card>
                </TabsContent>
                
                <TabsContent value="leaderboard" className="mt-0">
                      <Card className="border-0 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                         <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Session Rank</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                            <div className="p-4">
                                <IndividualLeaderboard leaderboard={leaderboard} currentPlayerId={playerId} />
                            </div>
                        </CardContent>
                      </Card>
                </TabsContent>
             </Tabs>
             
             {/* Mini Instructions or Info */}
             <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900/30">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 opacity-90 text-xs">
                    <li>Navigate freely between questions.</li>
                    <li>Click <b>Save Answer</b> to record your choice.</li>
                    <li>Submit Quiz when you are done.</li>
                </ul>
             </div>
        </div>
      </div>
    </div>
  );
};

export default IndividualAutoMode;

