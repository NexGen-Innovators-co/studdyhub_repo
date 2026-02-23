// src/components/educator/RoleUpgradePanel.tsx
// Reusable panel that lets an already-onboarded user request a verified
// educator role (school_admin, tutor_affiliated, tutor_independent).
// Requests go through admin review — users can NOT self-assign educator roles.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { useRoleVerification } from '@/hooks/useRoleVerification';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  ArrowRight,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Clock,
  XCircle,
  Upload,
  FileText,
  X,
} from 'lucide-react';
import { EducatorRoleStep } from '@/components/educator/onboarding/EducatorRoleStep';
import { CreateInstitutionFlow } from '@/components/educator/onboarding/CreateInstitutionFlow';
import { JoinInstitutionFlow } from '@/components/educator/onboarding/JoinInstitutionFlow';
import { IndependentTutorSetup } from '@/components/educator/onboarding/IndependentTutorSetup';
import type { UserRole, VerificationDocument } from '@/types/Education';

type SubFlow = 'create_institution' | 'join_institution' | 'independent_setup' | null;

interface RoleUpgradePanelProps {
  /** Where to navigate after successful upgrade (default: /educator) */
  redirectTo?: string;
  /** When true, render in a compact card style for embedding in settings */
  compact?: boolean;
}

export const RoleUpgradePanel: React.FC<RoleUpgradePanelProps> = ({
  redirectTo = '/educator',
  compact = false,
}) => {
  const { user } = useAuth();
  const { userProfile, refetchEducatorPermissions } = useAppContext();
  const navigate = useNavigate();
  const {
    currentRequest,
    isLoading: verificationLoading,
    isSubmitting,
    submitRequest,
    uploadDocument,
    refetch: refetchVerification,
  } = useRoleVerification();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [subFlow, setSubFlow] = useState<SubFlow>(null);
  const [submitted, setSubmitted] = useState(false);

  // Document upload state
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [qualifications, setQualifications] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Sub-flow collected data
  const [subFlowData, setSubFlowData] = useState<Record<string, any> | null>(null);

  const currentRole = userProfile?.user_role || 'student';
  const isVerifiedEducator =
    ['school_admin', 'tutor_affiliated', 'tutor_independent'].includes(currentRole) &&
    userProfile?.role_verification_status === 'verified';

  const roleLabels: Record<string, string> = {
    school_admin: 'School Administrator',
    tutor_affiliated: 'Affiliated Tutor',
    tutor_independent: 'Independent Tutor',
    student: 'Student',
  };

  // ─── Role selection → sub-flow mapping ───
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    switch (role) {
      case 'school_admin':
        setSubFlow('create_institution');
        break;
      case 'tutor_affiliated':
        setSubFlow('join_institution');
        break;
      case 'tutor_independent':
        setSubFlow('independent_setup');
        break;
      default:
        setSubFlow(null);
    }
  };

  // ─── Submit verification request via RPC (NOT direct profile update) ───
  const handleSubmitVerification = async () => {
    if (!user?.id || !selectedRole) return;

    const success = await submitRequest({
      requestedRole: selectedRole,
      institutionId: subFlowData?.institutionId || null,
      qualifications: qualifications || subFlowData?.bio || undefined,
      yearsExperience: subFlowData?.yearsExperience || undefined,
      specializations: subFlowData?.specializations || undefined,
      additionalNotes: additionalNotes || undefined,
      documents,
    });

    if (success) {
      setSubmitted(true);
      // Refresh educator permissions to pick up the new pending status
      if (refetchEducatorPermissions) {
        await refetchEducatorPermissions();
      }
    }
  };

  // ─── Document upload handler ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const uploaded: VerificationDocument[] = [];

    for (const file of Array.from(files)) {
      // Validate: max 10MB, common doc types
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: only PDF, JPEG, PNG, WebP files are accepted`);
        continue;
      }

      const doc = await uploadDocument(file);
      if (doc) uploaded.push(doc);
    }

    setDocuments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    // Reset the input
    e.target.value = '';
  };

  const removeDocument = (idx: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubFlowComplete = (data?: any) => {
    setSubFlowData(data || null);
    // Move to the credential upload step instead of saving the role
    setSubFlow(null);
  };

  const handleSubFlowSkip = () => {
    setSubFlowData(null);
    setSubFlow(null);
  };

  const handleGoToPortal = () => navigate(redirectTo);
  const handleGoToDashboard = () => navigate('/dashboard');

  const handleBack = () => {
    if (subFlow) {
      setSubFlow(null);
      setSelectedRole(null);
      setSubFlowData(null);
    } else if (selectedRole && !subFlow) {
      // Back from credential upload step to role selection
      setSelectedRole(null);
      setDocuments([]);
      setQualifications('');
      setAdditionalNotes('');
      setSubFlowData(null);
    }
  };

  // ─── Loading state ───
  if (verificationLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // ─── Already verified educator ───
  if (isVerifiedEducator && !submitted) {
    return (
      <div className={compact ? '' : 'min-h-[60vh] flex items-center justify-center p-4'}>
        <Card className="w-full max-w-lg rounded-2xl shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30 inline-block">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Verified Educator
            </h2>
            <p className="text-gray-500">
              Your role: <strong>{roleLabels[currentRole] || currentRole}</strong>
            </p>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Verified
            </Badge>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={handleGoToPortal} className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Go to Educator Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Pending verification ───
  if (currentRequest?.status === 'pending' || submitted) {
    return (
      <div className={compact ? '' : 'min-h-[60vh] flex items-center justify-center p-4'}>
        <Card className="w-full max-w-lg rounded-2xl shadow-lg border-amber-200 dark:border-amber-800/50">
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 inline-block">
              <Clock className="h-10 w-10 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Verification Under Review
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Your request to become{' '}
              <strong>
                {roleLabels[currentRequest?.requested_role || selectedRole || ''] || 'an Educator'}
              </strong>{' '}
              has been submitted. An admin will review your credentials and get back to you shortly.
            </p>
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Pending Review
            </Badge>
            {currentRequest?.created_at && (
              <p className="text-xs text-gray-400">
                Submitted {new Date(currentRequest.created_at).toLocaleDateString()}
              </p>
            )}
            <Button variant="outline" onClick={handleGoToDashboard} className="gap-2 mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Rejected — allow resubmission ───
  if (currentRequest?.status === 'rejected') {
    return (
      <div className={compact ? '' : 'min-h-[60vh] flex items-center justify-center p-4'}>
        <Card className="w-full max-w-lg rounded-2xl shadow-lg border-red-200 dark:border-red-800/50">
          <CardContent className="p-8 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-red-100 dark:bg-red-900/30 inline-block">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Verification Declined
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Your previous request was not approved.
            </p>
            {currentRequest.review_notes && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 text-left">
                <strong>Reason:</strong> {currentRequest.review_notes}
              </div>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleGoToDashboard}>
                Back to Dashboard
              </Button>
              <Button
                onClick={() => {
                  // Reset state to allow a new request
                  setSelectedRole(null);
                  setSubFlow(null);
                  setDocuments([]);
                  setQualifications('');
                  setAdditionalNotes('');
                  setSubFlowData(null);
                  // Clear current request so the form shows
                  refetchVerification();
                }}
                className="gap-2"
              >
                Submit New Request
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Sub-flow views (institution setup etc.) ───
  if (subFlow === 'create_institution') {
    return (
      <div className={compact ? '' : 'min-h-[60vh] p-4'}>
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to role selection
        </Button>
        <CreateInstitutionFlow onComplete={handleSubFlowComplete} onSkip={handleSubFlowSkip} />
      </div>
    );
  }

  if (subFlow === 'join_institution') {
    return (
      <div className={compact ? '' : 'min-h-[60vh] p-4'}>
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to role selection
        </Button>
        <JoinInstitutionFlow onComplete={handleSubFlowComplete} onSkip={handleSubFlowSkip} />
      </div>
    );
  }

  if (subFlow === 'independent_setup') {
    return (
      <div className={compact ? '' : 'min-h-[60vh] p-4'}>
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to role selection
        </Button>
        <IndependentTutorSetup onComplete={handleSubFlowComplete} onSkip={handleSubFlowSkip} />
      </div>
    );
  }

  // ─── Credential upload step (after role + sub-flow selected) ───
  if (selectedRole && !subFlow) {
    return (
      <div className={compact ? 'space-y-6' : 'min-h-[60vh] flex flex-col items-center justify-center p-4 space-y-6'}>
        <div className="w-full max-w-lg">
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to role selection
          </Button>

          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6 space-y-5">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Verify Your Credentials
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload supporting documents to verify your{' '}
                  <strong>{roleLabels[selectedRole]}</strong> role.
                  An admin will review your request.
                </p>
              </div>

              {/* Qualifications */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Qualifications / Bio
                </label>
                <textarea
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="Describe your qualifications, teaching experience, certifications..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={1000}
                />
              </div>

              {/* Additional notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Additional Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any additional context for the reviewer..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[60px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={500}
                />
              </div>

              {/* Document upload */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Supporting Documents <span className="text-gray-400">(PDF, images — max 10MB each)</span>
                </label>

                {/* Uploaded docs list */}
                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="truncate">{doc.name}</span>
                          {doc.size && (
                            <span className="text-gray-400 shrink-0">
                              ({(doc.size / 1024).toFixed(0)} KB)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeDocument(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : (
                    <Upload className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-500">
                    {uploading ? 'Uploading...' : 'Click to upload documents'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleSubmitVerification}
                  disabled={isSubmitting || !qualifications.trim()}
                  className="flex-1 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit for Verification
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-gray-400">
                Your request will be reviewed by an admin. You'll be notified once approved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Role selection view (initial) ───
  return (
    <div className={compact ? 'space-y-6' : 'min-h-[60vh] flex flex-col items-center justify-center p-4 space-y-6'}>
      {!compact && (
        <div className="text-center space-y-2 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Become an Educator
          </h1>
          <p className="text-gray-500 max-w-md">
            Choose your educator role and submit your credentials for verification.
            An admin will review and approve your request.
          </p>
        </div>
      )}

      <EducatorRoleStep
        selectedRole={selectedRole}
        onRoleSelect={handleRoleSelect}
      />

      {selectedRole && (
        <Button
          size="lg"
          onClick={() => handleRoleSelect(selectedRole)}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default RoleUpgradePanel;
