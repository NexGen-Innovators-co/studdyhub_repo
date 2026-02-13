// src/components/quizzes/hooks/useQuizManagement.ts - UPDATED
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';
import { ClassRecording, Quiz, QuizQuestion } from '../../../types/Class';
import { QuizAttempt } from '../../../types/EnhancedClasses';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
}

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
  confirmAction?: (options: ConfirmOptions) => Promise<boolean>;
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
  const { confirm: confirmAction, ConfirmDialogComponent } = useConfirmDialog();

  // Generate quiz from notes
  const handleGenerateQuizFromNotes = useCallback(async (
    notesContent: string,
    numQuestions: number,
    difficulty: string
  ) => {
    const toastId = toast.loading('Generating quiz from notes...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('generate-quiz-from-notes', {
        body: {
          notes_content: notesContent,
          num_questions: numQuestions,
          difficulty: difficulty,
        },
      });

      if (error) throw new Error(error.message || 'Failed to generate quiz from notes');

      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
        toast.error('Unable to generate quiz questions from these notes. Try adding more detailed content.', { id: toastId });
        return;
      }

      const notesClassId = crypto.randomUUID();

      const quiz: Quiz = {
        title: data.title || 'Notes Quiz',
        questions: data.questions,
        user_id: user.id,
        created_at: new Date().toISOString(),
        source_type: 'notes'
      };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          class_id: quiz.class_id,
          title: quiz.title,
          questions: quiz.questions as any,
          user_id: user.id,
          created_at: quiz.created_at,
          source_type: 'notes'
        });

      if (insertError) throw new Error(`Failed to save quiz: ${insertError.message}`);

      const notesRecording: ClassRecording = {
        id: notesClassId,
        title: 'Notes Quiz',
        audio_url: '',
        transcript: notesContent.substring(0, 200) + '...',
        summary: 'Generated from user notes',
        duration: 0,
        subject: 'Personal Notes',
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        userId: user.id, // Keep for legacy if needed
        user_id: user.id
      };

      onGenerateQuiz(notesRecording, quiz);
      setQuizMode({ recording: notesRecording, quiz });
      setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestionIndex(0);
      setShowResults(false);
      setQuizStartTime(Date.now());

      toast.success('Quiz generated from notes!', { id: toastId });
    } catch (error) {

      toast.error('Failed to generate quiz from notes', { id: toastId });
    }
  }, [onGenerateQuiz]);

  // Generate AI-powered adaptive quiz
  // Update the handleGenerateAIQuiz function in useQuizManagement.ts
  const handleGenerateAIQuiz = useCallback(async (
    topics: string[],
    focusAreas: string[]
  ) => {
    const toastId = toast.loading('Creating AI-powered quiz...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');





      // Get user's quiz performance data for personalization
      const { data: recentAttempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (attemptsError) {

      } else {

      }



      const { data, error } = await supabase.functions.invoke('generate-ai-quiz', {
        body: {
          user_topics: topics,
          focus_areas: focusAreas,
          recent_performance: recentAttempts?.map(attempt => ({
            score: attempt.percentage,
            time_taken: attempt.time_taken_seconds
          })) || [],
          learning_style: 'adaptive'
        },
      });

      if (error) {

        throw new Error(error.message || 'Failed to generate AI quiz');
      }



      if (!data) {
        throw new Error('No data received from AI quiz generation');
      }

      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('AI generated quiz has no valid questions');
      }

      const aiClassId = crypto.randomUUID();

      const quiz: Quiz = {
        title: data.title || 'AI Smart Quiz',
        questions: data.questions,
        user_id: user.id,
        created_at: new Date().toISOString(),
        source_type: 'ai'
      };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          title: quiz.title,
          questions: quiz.questions as any,
          user_id: user.id,
          created_at: quiz.created_at,
          source_type: 'ai'
        });

      if (insertError) {
        throw insertError;
      }

      const aiRecording: ClassRecording = {
        id: aiClassId,
        title: 'AI Smart Quiz',
        audioUrl: '', // Keep for legacy if needed
        audio_url: '',
        transcript: `AI-generated quiz focusing on: ${topics.join(', ')}`,
        summary: `Personalized quiz with focus on: ${focusAreas.join(', ')}`,
        duration: 0,
        subject: 'Multiple Topics',
        date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        userId: user.id, // Keep for legacy if needed
        user_id: user.id
      };

      onGenerateQuiz(aiRecording, quiz);
      setQuizMode({ recording: aiRecording, quiz });
      setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
      setCurrentQuestionIndex(0);
      setShowResults(false);
      setQuizStartTime(Date.now());

      toast.success('AI Smart Quiz generated!', { id: toastId });

    } catch (error) {
      //console.error('💥 Full error in handleGenerateAIQuiz:', error);

      let errorMessage = 'Failed to generate AI quiz';
      if (error instanceof Error) {
        errorMessage = error.message;
        //console.error('💥 Error message:', error.message);
        //console.error('💥 Error stack:', error.stack);
      }

      toast.error(errorMessage, { id: toastId });
    }
  }, [onGenerateQuiz]);

  // Original recording-based quiz generation
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
        class_id: recording.id,
        title: data.title || recording.title,
        questions: data.questions,
        user_id: user.id,
        created_at: new Date().toISOString(),
        source_type: 'recording'
      };

      const { error: insertError } = await supabase
        .from('quizzes')
        .insert({
          id: quiz.id,
          class_id: quiz.class_id,
          title: quiz.title,
          questions: quiz.questions as any,
          user_id: user.id,
          created_at: quiz.created_at,
          source_type: 'recording'
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
      //console.error('Error generating quiz:', error);
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

  const handleSelectQuizMode = useCallback((recording: ClassRecording, quiz: Quiz) => {
    setQuizMode({ recording, quiz });
    setUserAnswers(new Array(quiz.questions?.length || 0).fill(null));
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setQuizStartTime(Date.now());
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
      if (confirmAction) {
        const confirmed = await confirmAction({
          title: 'Unanswered Questions',
          description: `You have ${unansweredCount} unanswered question(s). Submit anyway?`,
          confirmLabel: 'Submit Anyway',
        });
        if (!confirmed) return;
      } else {
        const confirmed = window.confirm(
          `You have ${unansweredCount} unanswered question(s). Submit anyway?`
        );
        if (!confirmed) return;
      }
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

      // Show personalized success message based on performance
      const percentage = Math.round((score / totalQuestions) * 100);
      let successMessage = 'Quiz submitted successfully!';

      if (percentage >= 90) {
        successMessage = 'Outstanding! Perfect or near-perfect score! 🎉';
      } else if (percentage >= 75) {
        successMessage = 'Great job! Solid performance! 👍';
      } else if (percentage >= 60) {
        successMessage = 'Good effort! Keep practicing! 💪';
      } else {
        successMessage = 'Quiz completed! Review the answers to improve! 📚';
      }

      toast.success(successMessage, { id: toastId });
    } catch (error) {
      //console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz. Please try again.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [quizMode, userAnswers, quizStartTime, recordQuizAttempt, fetchUserStats, isSubmitting, confirmAction]);

  const handleExitQuizMode = useCallback(async () => {
    if (!showResults && userAnswers.some(answer => answer !== null)) {
      if (confirmAction) {
        const confirmed = await confirmAction({
          title: 'Exit Quiz',
          description: 'You have not submitted this quiz. Your progress will be lost. Continue?',
          confirmLabel: 'Exit',
          variant: 'destructive',
        });
        if (!confirmed) return;
      } else {
        const confirmed = window.confirm(
          'You have not submitted this quiz. Your progress will be lost. Continue?'
        );
        if (!confirmed) return;
      }
    }

    setQuizMode(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
    setQuizStartTime(null);
  }, [showResults, userAnswers, confirmAction]);

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
    handleGenerateQuizFromNotes,
    handleGenerateAIQuiz,
    handleAnswerSelect,
    handleSelectQuizMode,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    handleSubmitQuiz,
    calculateScore,
    setQuizMode,
  };
};