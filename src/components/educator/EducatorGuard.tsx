// src/components/educator/EducatorGuard.tsx
// Route guard that shows non-educators a CTA to upgrade,
// pending-verification users a "waiting" state, and rejected users a retry CTA.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEducatorContext } from '@/contexts/EducatorContext';
import ModernPremiumLoader from '@/components/ui/ModernPremiumLoader';
import { GraduationCap, ArrowRight, ArrowLeft, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EducatorGuardProps {
  children: React.ReactNode;
}

export const EducatorGuard: React.FC<EducatorGuardProps> = ({ children }) => {
  const { permissions, permissionsLoading: isLoading } = useEducatorContext();
  const navigate = useNavigate();

  if (isLoading) {
    return <ModernPremiumLoader fullScreen={false} size="md" text="LOADING" />;
  }

  // ─── Pending verification ───
  if (permissions.roleVerificationStatus === 'pending') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl shadow-lg border-amber-200 dark:border-amber-800/50">
          <CardContent className="p-8 text-center space-y-5">
            <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 inline-block">
              <Clock className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Verification In Progress
            </h2>
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Pending Review
            </Badge>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Your educator application is being reviewed by an admin.
              You'll gain full access once approved.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Rejected verification ───
  if (permissions.roleVerificationStatus === 'rejected') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl shadow-lg border-red-200 dark:border-red-800/50">
          <CardContent className="p-8 text-center space-y-5">
            <div className="p-4 rounded-2xl bg-red-100 dark:bg-red-900/30 inline-block">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Verification Declined
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Your educator application was not approved. You can submit a new request with updated credentials.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => navigate('/educator/upgrade')}
                className="gap-2"
              >
                Resubmit Application
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Not an educator at all ───
  if (!permissions.isEducator) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl shadow-lg border-gray-200 dark:border-gray-700">
          <CardContent className="p-8 text-center space-y-5">
            <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 inline-block">
              <GraduationCap className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Educator Access Required
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Submit your credentials for verification to create courses, manage students, and access the full Educator Portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => navigate('/educator/upgrade')}
                className="gap-2"
              >
                Become an Educator
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default EducatorGuard;
