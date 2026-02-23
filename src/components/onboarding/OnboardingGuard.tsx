// src/components/onboarding/OnboardingGuard.tsx
// App-level guard that redirects unauthenticated users and shows onboarding
// wizard if onboarding is not complete. Wraps all authenticated routes.

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { isOnboardingComplete } from './OnboardingWizard';
import { UserProfile } from '@/types/Document';

const OnboardingWizard = React.lazy(() => import('./OnboardingWizard'));

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const { userProfile, setUserProfile } = useAppContext();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      // Not signed in — never show onboarding
      setShowOnboarding(false);
      return;
    }

    // Fast path: localStorage already marked complete
    if (isOnboardingComplete(userProfile)) {
      setShowOnboarding(false);
      return;
    }

    // Wait until the profile has actually loaded before deciding.
    // userProfile === null means it's still being fetched.
    if (userProfile === null) return;

    // Profile loaded and onboarding is NOT complete → show wizard
    setShowOnboarding(true);
  }, [user, userProfile]);

  const handleOnboardingComplete = (updatedProfile?: UserProfile) => {
    setShowOnboarding(false);
    if (updatedProfile) {
      setUserProfile(updatedProfile);
    }
  };

  if (showOnboarding && user) {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="h-8 w-8 rounded-full border-3 border-blue-500 border-t-transparent animate-spin" />
          </div>
        }
      >
        <OnboardingWizard
          userProfile={userProfile}
          userId={user.id}
          onComplete={handleOnboardingComplete}
        />
      </React.Suspense>
    );
  }

  return <>{children}</>;
};

export default OnboardingGuard;
