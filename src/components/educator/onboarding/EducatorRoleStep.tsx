// src/components/educator/onboarding/EducatorRoleStep.tsx
// Onboarding step for selecting educator role type.

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { School, Building2, GraduationCap, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/Education';

interface EducatorRoleStepProps {
  selectedRole: UserRole | null;
  onRoleSelect: (role: UserRole) => void;
}

interface RoleOption {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'school_admin',
    label: 'School Administrator',
    description: 'Manage an institution, invite educators and students, create courses.',
    icon: Building2,
    color: 'from-blue-500 to-blue-600',
  },
  {
    role: 'tutor_affiliated',
    label: 'Affiliated Tutor',
    description: 'Teach under an institution. Create courses within your school.',
    icon: School,
    color: 'from-purple-500 to-purple-600',
  },
  {
    role: 'tutor_independent',
    label: 'Independent Tutor',
    description: 'Teach independently. Create and publish your own courses.',
    icon: GraduationCap,
    color: 'from-green-500 to-green-600',
  },
];

export const EducatorRoleStep: React.FC<EducatorRoleStepProps> = ({
  selectedRole,
  onRoleSelect,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          How will you use StuddyHub?
        </h2>
        <p className="text-gray-500">
          Choose the role that best describes your teaching setup.
        </p>
      </div>

      <div className="grid gap-4 max-w-lg mx-auto">
        {ROLE_OPTIONS.map(({ role, label, description, icon: Icon, color }) => (
          <Card
            key={role}
            className={cn(
              'cursor-pointer rounded-2xl transition-all hover:shadow-lg',
              selectedRole === role
                ? 'ring-2 ring-blue-500 border-blue-200 dark:border-blue-800 shadow-md'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            )}
            onClick={() => onRoleSelect(role)}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div
                className={cn(
                  'p-3 rounded-xl bg-gradient-to-br text-white flex-shrink-0',
                  color
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EducatorRoleStep;
