// In SocialDataContext.tsx
import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useSocialData } from '../hooks/useSocialData';
import { useAppContext } from '../../../hooks/useAppContext';
import { clearCache } from '../../../utils/socialCache';

const SocialDataContext = createContext<ReturnType<typeof useSocialData> | null>(null);

export const SocialDataProvider = ({ children }: { children: ReactNode }) => {
  const { userProfile, user } = useAppContext();
  
  const socialData = useSocialData(userProfile, 'newest', 'all');
  
  // 🔥 ADD THIS: Clear social data when user changes
  useEffect(() => {
    if (!user) {
      // User logged out, clear cache
      clearCache();
      console.log('🔴 User logged out - social cache cleared');
    }
  }, [user]);
  
  return (
    <SocialDataContext.Provider value={socialData}>
      {children}
    </SocialDataContext.Provider>
  );
};

export const useSocialDataContext = () => {
  const context = useContext(SocialDataContext);
  if (!context) {
    throw new Error('useSocialDataContext must be used within SocialDataProvider');
  }
  return context;
};