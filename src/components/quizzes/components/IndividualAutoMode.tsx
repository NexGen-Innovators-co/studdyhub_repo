

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
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

  // Fetch quiz state on mount and when sessionId/playerId changes
  useEffect(() => {
    const fetchState = async () => {
      setLoading(true);
      try {
        const state = await getIndividualQuizState(sessionId, playerId);
        if (!state) {
          // console.error('Failed to fetch individual quiz state for session:', sessionId, 'player:', playerId);
          setLoading(false);
          setTimeout(() => window.location.reload(), 3000);
          return;
        }
        setQuizState(state);
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

  // Timer logic (per question)
  useEffect(() => {
    if (!quizState) return;
    const current = quizState.questions?.[currentQuestionIndex];
    if (!current || !current.time_limit) return;
    setTimer(current.time_limit);
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [quizState, currentQuestionIndex]);

  // Handle answer submission
  const handleSubmit = async () => {
    if (!quizState) return;
    setSubmitting(true);
    const current = quizState.questions[currentQuestionIndex];
    await submitAnswerIndividual({
      sessionId,
      playerId,
      questionId: current.id,
      questionIndex: currentQuestionIndex,
      selectedOption: selectedOption ?? -1,
      timeSpent: (current.time_limit ?? 0) - timer,
    });
    setSubmitting(false);
    // Refresh state after answer
    const state = await getIndividualQuizState(sessionId, playerId);
    setQuizState(state);
    setLeaderboard(state?.leaderboard || []);
  };

  // Handle manual advance
  const handleAdvance = async () => {
    await advanceIndividual(sessionId, playerId);
    setCurrentQuestionIndex((idx) => Math.min(idx + 1, (quizState?.questions?.length ?? 1) - 1));
    // Optionally refresh state
    const state = await getIndividualQuizState(sessionId, playerId);
    setQuizState(state);
    setLeaderboard(state?.leaderboard || []);
    setSelectedOption(null);
  };

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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Individual Auto Mode</h2>
          <p className="text-sm text-gray-500">Answer at your own pace</p>
        </div>
        <Badge variant="outline" className="w-fit">Question {currentQuestionIndex + 1} of {totalQuestions}</Badge>
      </div>

      <ProgressTracker current={currentQuestionIndex + 1} total={totalQuestions} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Questions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <QuestionList
                questions={quizState.questions}
                playerProgress={playerProgress}
                currentQuestionIndex={currentQuestionIndex}
                onSelectQuestion={setCurrentQuestionIndex}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt: string, idx: number) => (
                  <Button
                    key={idx}
                    type="button"
                    variant={selectedOption === idx ? 'default' : 'outline'}
                    className="justify-start whitespace-normal text-left h-auto py-3"
                    onClick={() => setSelectedOption(idx)}
                    disabled={submitting}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span> {opt}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">Time left: <span className="font-semibold text-gray-800">{timer}s</span></div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={submitting || selectedOption === null}>
                    Submit Answer
                  </Button>
                  <Button variant="secondary" onClick={handleAdvance}>
                    Next Question
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <IndividualLeaderboard leaderboard={leaderboard} currentPlayerId={playerId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IndividualAutoMode;

