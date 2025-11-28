// src/components/classRecordings/hooks/useEnhancedQuizManagement.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { ClassRecording, Quiz, QuizQuestion } from '../../../types/Class';
import { QuizAttempt } from '../../../types/EnhancedClasses';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface UseQuizManagementProps {
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void;
  recordQuizAttempt: (
    quizId: string,
    score: number,
    totalQuestions: number,
    answers: QuizAttempt['answers'],
    timeTaken: number
  ) => Promise<QuizAttempt | null>;
  fetchUserStats: () => Promise<void>;
}

export const useQuizManagement = ({
  onGenerateQuiz,
  recordQuizAttempt,
  fetchUserStats
}: UseQuizManagementProps) => {
  const [quizMode, setQuizMode] = useState<{ recording: ClassRecording; quiz: Quiz } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateQuizFromRecording = useCallback(async (
    recording: ClassRecording,
    numQuestions: number,
    difficulty: string
  ) => {
    const toastId = toast.loading('Generating quiz...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!recording.transcript || recording.transcript.split(' ').length < 50) {
        toast.error('This content may not be suitable for quiz generation. Please try a recording with more informational content.', { id: toastId });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          name: recording.title,
          file_url: recording.audioUrl,
          transcript: recording.transcript,
          num_questions: numQuestions,
          difficulty: difficulty,
        },
      });

      if (error) throw new Error(error.message || 'Failed to generate quiz');

      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        toast.error('Unable to generate quiz questions from this content. Try a recording with more structured information.', { id: toastId });
        return;
      }

      const quiz: Quiz = {
        id: generateId(),
        classId: recording.id,
        title: data.title || recording.title,
        questions: data.questions,
        userId: user.id,
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          class_id: quiz.classId,
          title: quiz.title,
          questions: quiz.questions as any,
          user_id: user.id,
          created_at: quiz.created_at
        });

      if (insertError) throw new Error(`Failed to save quiz to database: ${insertError.message}`);

      onGenerateQuiz(recording, quiz);
      setQuizMode({ recording, quiz });
      setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestionIndex(0);
      setShowResults(false);
      setQuizStartTime(Date.now());

      toast.success('Quiz generated successfully!', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to generate quiz.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}`;
        if (error.message.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage, { id: toastId });
      console.error('Error generating quiz:', error);
      setQuizMode(null);
    }
  }, [onGenerateQuiz]);

  const handleAnswerSelect = useCallback((questionIndex: number, optionIndex: number) => {
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = optionIndex;
      return newAnswers;
    });
  }, []);

  const handleNextQuestion = useCallback(() => {
    const totalQuestions = quizMode?.quiz?.questions?.length || 0;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  }, [currentQuestionIndex, quizMode]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex]);

  const handleSubmitQuiz = useCallback(async () => {
    if (!quizMode || isSubmitting) return;

    const unansweredCount = userAnswers.filter(answer => answer === null).length;
    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Submit anyway?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Submitting quiz...');

    try {
      const totalQuestions = quizMode.quiz.questions.length;
      let score = 0;
      const answers: QuizAttempt['answers'] = [];

      quizMode.quiz.questions.forEach((question, index) => {
        const isCorrect = userAnswers[index] === question.correctAnswer;
        if (isCorrect) score++;

        answers.push({
          question_index: index,
          selected_answer: userAnswers[index] ?? -1,
          correct_answer: question.correctAnswer,
          is_correct: isCorrect,
        });
      });

      const timeTaken = quizStartTime
        ? Math.floor((Date.now() - quizStartTime) / 1000)
        : 0;

      await recordQuizAttempt(
        quizMode.quiz.id,
        score,
        totalQuestions,
        answers,
        timeTaken
      );

      await fetchUserStats();

      setShowResults(true);
      toast.success('Quiz submitted successfully!', { id: toastId });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz. Please try again.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [quizMode, userAnswers, quizStartTime, recordQuizAttempt, fetchUserStats, isSubmitting]);

  const handleExitQuizMode = useCallback(() => {
    if (!showResults && userAnswers.some(answer => answer !== null)) {
      const confirmed = window.confirm(
        'You have not submitted this quiz. Your progress will be lost. Continue?'
      );
      if (!confirmed) return;
    }

    setQuizMode(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
    setQuizStartTime(null);
  }, [showResults, userAnswers]);

  const calculateScore = useCallback((): number => {
    if (!quizMode?.quiz?.questions?.length) return 0;

    const totalQuestions = quizMode.quiz.questions.length;
    const correctAnswers = quizMode.quiz.questions.reduce((score, question, index) => {
      return userAnswers[index] === question.correctAnswer ? score + 1 : score;
    }, 0);

    return Math.round((correctAnswers / totalQuestions) * 100);
  }, [quizMode, userAnswers]);

  return {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    quizStartTime,
    isSubmitting,
    handleGenerateQuizFromRecording,
    handleAnswerSelect,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    handleSubmitQuiz,
    calculateScore,
    setQuizMode,
  };
};