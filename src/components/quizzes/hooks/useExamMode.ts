// src/components/quizzes/hooks/useExamMode.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { Quiz, QuizQuestion } from '../../../types/Class';
import { QuizAttempt } from '../../../types/EnhancedClasses';

export interface ExamModeSettings {
  timeLimitMinutes: number;      // 0 = no limit
  shuffleQuestions: boolean;
  lockAnswers: boolean;           // Once confirmed, can't go back
  showTimer: boolean;
  enableTabDetection: boolean;    // Warn on tab switch
}

export const DEFAULT_EXAM_SETTINGS: ExamModeSettings = {
  timeLimitMinutes: 15,
  shuffleQuestions: true,
  lockAnswers: false,
  showTimer: true,
  enableTabDetection: true,
};

export interface ExamModeState {
  isActive: boolean;
  isFullscreen: boolean;
  settings: ExamModeSettings;
  timeRemainingSeconds: number;
  tabSwitchCount: number;
  flaggedQuestions: Set<number>;     // Question indices flagged for review
  confirmedAnswers: Set<number>;     // Question indices with locked answers
  questionOrder: number[];           // Shuffled or original question indices
  startedAt: number | null;
}

export interface UseExamModeReturn {
  // State
  examState: ExamModeState;
  isExamActive: boolean;

  // Setup
  startExam: (quiz: Quiz, settings: ExamModeSettings) => void;
  endExam: () => void;

  // Timer
  timeRemainingSeconds: number;
  timeExpired: boolean;
  formattedTime: string;

  // Fullscreen
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => void;
  isFullscreen: boolean;

  // Question management
  flagQuestion: (index: number) => void;
  unflagQuestion: (index: number) => void;
  isQuestionFlagged: (index: number) => boolean;
  confirmAnswer: (index: number) => void;
  isAnswerConfirmed: (index: number) => boolean;
  getShuffledIndex: (displayIndex: number) => number;   // Map display order -> actual question index
  getDisplayIndex: (actualIndex: number) => number;      // Map actual question index -> display order

  // Anti-cheat
  tabSwitchCount: number;

  // Settings
  settings: ExamModeSettings;
  updateSettings: (settings: Partial<ExamModeSettings>) => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function useExamMode(): UseExamModeReturn {
  const [examState, setExamState] = useState<ExamModeState>({
    isActive: false,
    isFullscreen: false,
    settings: DEFAULT_EXAM_SETTINGS,
    timeRemainingSeconds: 0,
    tabSwitchCount: 0,
    flaggedQuestions: new Set(),
    confirmedAnswers: new Set(),
    questionOrder: [],
    startedAt: null,
  });

  const [timeExpired, setTimeExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabSwitchRef = useRef(0);

  // ---- Timer ----
  useEffect(() => {
    if (examState.isActive && examState.settings.timeLimitMinutes > 0) {
      timerRef.current = setInterval(() => {
        setExamState(prev => {
          const newTime = prev.timeRemainingSeconds - 1;
          if (newTime <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeExpired(true);
            return { ...prev, timeRemainingSeconds: 0 };
          }
          return { ...prev, timeRemainingSeconds: newTime };
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [examState.isActive, examState.settings.timeLimitMinutes]);

  // ---- Tab visibility detection ----
  useEffect(() => {
    if (!examState.isActive || !examState.settings.enableTabDetection) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        setExamState(prev => ({
          ...prev,
          tabSwitchCount: prev.tabSwitchCount + 1,
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examState.isActive, examState.settings.enableTabDetection]);

  // ---- Fullscreen change listener ----
  useEffect(() => {
    const handleFullscreenChange = () => {
      setExamState(prev => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format time as mm:ss
  const formattedTime = (() => {
    const mins = Math.floor(examState.timeRemainingSeconds / 60);
    const secs = examState.timeRemainingSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  })();

  // ---- Actions ----

  const startExam = useCallback((quiz: Quiz, settings: ExamModeSettings) => {
    const questionCount = quiz.questions?.length || 0;
    const indices = Array.from({ length: questionCount }, (_, i) => i);
    const order = settings.shuffleQuestions ? shuffleArray(indices) : indices;

    tabSwitchRef.current = 0;
    setTimeExpired(false);

    setExamState({
      isActive: true,
      isFullscreen: false,
      settings,
      timeRemainingSeconds: settings.timeLimitMinutes * 60,
      tabSwitchCount: 0,
      flaggedQuestions: new Set(),
      confirmedAnswers: new Set(),
      questionOrder: order,
      startedAt: Date.now(),
    });
  }, []);

  const endExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    setExamState(prev => ({
      ...prev,
      isActive: false,
      isFullscreen: false,
      startedAt: null,
    }));
    setTimeExpired(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setExamState(prev => ({ ...prev, isFullscreen: true }));
    } catch (err) {
      // Fullscreen not supported or denied — proceed without it
      console.warn('Fullscreen not available:', err);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setExamState(prev => ({ ...prev, isFullscreen: false }));
  }, []);

  const flagQuestion = useCallback((index: number) => {
    setExamState(prev => {
      const flagged = new Set(prev.flaggedQuestions);
      flagged.add(index);
      return { ...prev, flaggedQuestions: flagged };
    });
  }, []);

  const unflagQuestion = useCallback((index: number) => {
    setExamState(prev => {
      const flagged = new Set(prev.flaggedQuestions);
      flagged.delete(index);
      return { ...prev, flaggedQuestions: flagged };
    });
  }, []);

  const isQuestionFlagged = useCallback((index: number) => {
    return examState.flaggedQuestions.has(index);
  }, [examState.flaggedQuestions]);

  const confirmAnswer = useCallback((index: number) => {
    setExamState(prev => {
      const confirmed = new Set(prev.confirmedAnswers);
      confirmed.add(index);
      return { ...prev, confirmedAnswers: confirmed };
    });
  }, []);

  const isAnswerConfirmed = useCallback((index: number) => {
    return examState.confirmedAnswers.has(index);
  }, [examState.confirmedAnswers]);

  const getShuffledIndex = useCallback((displayIndex: number) => {
    return examState.questionOrder[displayIndex] ?? displayIndex;
  }, [examState.questionOrder]);

  const getDisplayIndex = useCallback((actualIndex: number) => {
    const idx = examState.questionOrder.indexOf(actualIndex);
    return idx >= 0 ? idx : actualIndex;
  }, [examState.questionOrder]);

  const updateSettings = useCallback((partial: Partial<ExamModeSettings>) => {
    setExamState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  }, []);

  return {
    examState,
    isExamActive: examState.isActive,

    startExam,
    endExam,

    timeRemainingSeconds: examState.timeRemainingSeconds,
    timeExpired,
    formattedTime,

    enterFullscreen,
    exitFullscreen,
    isFullscreen: examState.isFullscreen,

    flagQuestion,
    unflagQuestion,
    isQuestionFlagged,
    confirmAnswer,
    isAnswerConfirmed,
    getShuffledIndex,
    getDisplayIndex,

    tabSwitchCount: examState.tabSwitchCount,

    settings: examState.settings,
    updateSettings,
  };
}
