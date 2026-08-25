import { useState, useEffect } from 'react';

const TUTORIAL_STORAGE_KEY = 'completed-tutorials';

export const useTutorial = (tutorialId: string) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const completedList = completed ? JSON.parse(completed) : [];
    setHasCompletedBefore(completedList.includes(tutorialId));
  }, [tutorialId]);

  const startTutorial = () => {
    setIsOpen(true);
  };

  const closeTutorial = () => {
    setIsOpen(false);
  };

  const completeTutorial = () => {
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const completedList = completed ? JSON.parse(completed) : [];
    if (!completedList.includes(tutorialId)) {
      completedList.push(tutorialId);
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(completedList));
    }
    setHasCompletedBefore(true);
  };

  const resetTutorial = () => {
    const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const completedList = completed ? JSON.parse(completed) : [];
    const filtered = completedList.filter((id: string) => id !== tutorialId);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(filtered));
    setHasCompletedBefore(false);
  };

  return {
    isOpen,
    startTutorial,
    closeTutorial,
    completeTutorial,
    hasCompletedBefore,
    resetTutorial,
  };
};
