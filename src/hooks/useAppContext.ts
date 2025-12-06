// Modified useAppContext.ts - Added socialData to return type
// useAppContext.ts
import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useSocialData } from '../hooks/useSocialData';  // For ReturnType

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return {
    ...context,
    socialData: context.socialData as ReturnType<typeof useSocialData>,  // Ensure type safety
  };
}