// src/components/educator/institution/InstitutionOverview.tsx
// Shows institution details — description, contact, education level, quick stats.

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Globe,
  MapPin,
  GraduationCap,
  ShieldCheck,
  Calendar,
  Users,
} from 'lucide-react';
import type { Institution, InstitutionMember } from '@/types/Education';

interface InstitutionOverviewProps {
  institution: Institution;
  membership: InstitutionMember | null;
}

export const InstitutionOverview: React.FC<InstitutionOverviewProps> = ({
  institution,
  membership,
}) => {
  const verificationColor: Record<string, string> = {
    verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    unverified: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Details */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Institution Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {institution.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {institution.description}
            </p>
          )}

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Badge className={verificationColor[institution.verification_status] || ''}>
                <ShieldCheck className="w-3 h-3 mr-1" />
                {institution.verification_status}
              </Badge>
            </div>

            {institution.education_level && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <GraduationCap className="w-4 h-4" />
                <span>{institution.education_level.name}</span>
              </div>
            )}

            {institution.country && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span>{institution.country.flag_emoji}</span>
                <span>{institution.country.name}</span>
              </div>
            )}

            {(institution.city || institution.region) && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{[institution.city, institution.region].filter(Boolean).join(', ')}</span>
              </div>
            )}

            {institution.website && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Globe className="w-4 h-4" />
                <a
                  href={institution.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {institution.website}
                </a>
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>
                Created {new Date(institution.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your membership */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            Your Membership
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <Badge variant="outline" className="capitalize">
              {membership?.role || 'Unknown'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <Badge variant="secondary" className="capitalize">
              {membership?.status || 'Unknown'}
            </Badge>
          </div>
          {membership?.title && (
            <div className="flex justify-between">
              <span className="text-gray-500">Title</span>
              <span className="text-gray-900 dark:text-white">{membership.title}</span>
            </div>
          )}
          {membership?.department && (
            <div className="flex justify-between">
              <span className="text-gray-500">Department</span>
              <span className="text-gray-900 dark:text-white">{membership.department}</span>
            </div>
          )}
          {membership?.joined_at && (
            <div className="flex justify-between">
              <span className="text-gray-500">Joined</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(membership.joined_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstitutionOverview;
