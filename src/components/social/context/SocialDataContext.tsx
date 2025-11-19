// components/social/context/SocialDataContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { useSocialData } from '../hooks/useSocialData';
import { useAppContext } from '../../../hooks/useAppContext';

const SocialDataContext = createContext<ReturnType<typeof useSocialData> | null>(null);

export const SocialDataProvider = ({ children }: { children: ReactNode }) => {
  // Get userProfile from AppContext
  const { userProfile } = useAppContext();
  
  // Use default sort and filter - these can be managed in SocialFeed component itself
  const socialData = useSocialData(userProfile, 'newest', 'all');
  
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