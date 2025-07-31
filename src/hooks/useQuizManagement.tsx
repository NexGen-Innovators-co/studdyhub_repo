// hooks/useQuizManagement.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateId } from '../utils/helpers';
import { ClassRecording, Quiz, QuizQuestion } from '../types/Class';
import { FunctionsHttpError } from '@supabase/supabase-js';

export const useQuizManagement = ({ onGenerateQuiz }: { onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void }) => {
  const [quizMode, setQuizMode] = useState<{ recording: ClassRecording; quiz: Quiz } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Updated signature to accept numQuestions and difficulty
  const handleGenerateQuizFromRecording = useCallback(async (recording: ClassRecording, numQuestions: number, difficulty: string) => {
    const toastId = toast.loading('Generating quiz...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!recording.transcript || recording.transcript.split(' ').length < 50) {
        toast.error('This content may not be suitable for quiz generation. Please try a recording with more informational content.', { id: toastId });
        return;
      }

      // Pass numQuestions and difficulty to the Edge Function
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          name: recording.title,
          file_url: recording.audioUrl,
          transcript: recording.transcript,
          numQuestions: numQuestions, // New parameter
          difficulty: difficulty,     // New parameter
        },
      });

      if (error) throw new Error(error.message || 'Failed to generate quiz');

      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        toast.error('Unable to generate quiz questions from this content. Try a recording with more structured information.', { id: toastId });
        console.warn('Invalid quiz data:', data);
        return;
      }

      const quiz: Quiz = {
        id: generateId(),
        classId: recording.id,
        title: data.title || recording.title,
        questions: data.questions,
        userId: user.id,
        createdAt: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          class_id: quiz.classId,
          title: quiz.title,
          questions: quiz.questions as any, // Cast to any for Supabase JSONB column
          user_id: user.id,
          created_at: quiz.createdAt
        });

      if (insertError) throw new Error(`Failed to save quiz to database: ${insertError.message}`);

      onGenerateQuiz(recording, quiz); // Notify parent component
      setQuizMode({ recording, quiz });
      setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestionIndex(0);
      setShowResults(false); // Reset showResults when a new quiz is generated
      toast.success('Quiz generated and saved successfully!', { id: toastId });
    } catch (error) {
      let errorMessage = 'Failed to generate quiz.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `Function error (${error.context.status}): ${error.context.statusText}. Check function logs.`;
        if (error.message.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('The model is overloaded')) {
          errorMessage = 'AI model is currently overloaded. Please try again in a few moments.';
        }
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
      setShowResults(true);
    }
  }, [currentQuestionIndex, quizMode]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex]);

  const handleExitQuizMode = useCallback(() => {
    setQuizMode(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
  }, []);

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
    handleGenerateQuizFromRecording,
    handleAnswerSelect,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    calculateScore,
  };
};
