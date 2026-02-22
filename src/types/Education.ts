// src/types/Education.ts — Educational context types

// ─── Reference Data Types ──────────────────────────────────────

export interface Country {
  id: string;
  code: string;       // ISO 3166-1 alpha-2
  name: string;
  flag_emoji: string | null;
}

export interface EducationLevel {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  category: 'pre_primary' | 'primary' | 'lower_secondary' | 'upper_secondary' | 'tertiary' | 'postgraduate';
}

export interface Curriculum {
  id: string;
  code: string;
  name: string;
  governing_body: string | null;
}

export interface Examination {
  id: string;
  code: string;
  name: string;
  typical_date: string | null;  // ISO date
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: 'core' | 'elective';
}

// ─── Education Framework (from RPC) ────────────────────────────

export interface EducationFrameworkCurriculum extends Curriculum {
  examinations: Examination[];
  subjects: Subject[];
}

export interface EducationFrameworkLevel extends EducationLevel {
  curricula: EducationFrameworkCurriculum[];
}

export interface EducationFramework {
  country: Country;
  education_levels: EducationFrameworkLevel[];
}

// ─── User Education Context (resolved & denormalized) ──────────

export interface UserEducationContext {
  profileId: string;
  country: Country | null;
  educationLevel: EducationLevel | null;
  curriculum: Curriculum | null;
  targetExamination: Examination | null;
  institutionName: string | null;
  yearOrGrade: string | null;
  expectedCompletion: string | null;   // ISO date
  subjects: Subject[];
  goals: Array<{ type: string; target: string }>;
  metadata: Record<string, unknown>;
}

// ─── Institution Types ──────────────────────────────────────────

export type InstitutionType = 'school' | 'university' | 'tutoring_center' | 'online_academy';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type InstitutionMemberRole = 'owner' | 'admin' | 'educator' | 'student';
export type InstitutionMemberStatus = 'invited' | 'pending' | 'active' | 'suspended' | 'removed';
export type UserRole = 'student' | 'school_admin' | 'tutor_affiliated' | 'tutor_independent';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  type: InstitutionType;
  country_id: string | null;
  education_level_id: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  verification_status: VerificationStatus;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Optional resolved relations
  country?: Country | null;
  education_level?: EducationLevel | null;
}

export interface InstitutionMember {
  id: string;
  institution_id: string;
  user_id: string;
  role: InstitutionMemberRole;
  status: InstitutionMemberStatus;
  title: string | null;
  department: string | null;
  invited_by: string | null;
  invite_code: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional resolved relations
  institution?: Institution;
}

export interface InstitutionInvite {
  id: string;
  institution_id: string;
  email: string;
  role: 'educator' | 'student';
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;
  expires_at: string;
  created_at: string;
}

// ─── Educator Permissions (computed client-side) ────────────────

export interface EducatorPermissions {
  isEducator: boolean;
  role: UserRole;
  institutionRole: InstitutionMemberRole | null;
  institutionId: string | null;
  institutionName: string | null;
  canCreateCourses: boolean;
  canPublishCourses: boolean;
  canManageMembers: boolean;
  canViewInstitutionAnalytics: boolean;
  canEditInstitutionSettings: boolean;
  canInviteStudents: boolean;
  canInviteEducators: boolean;
}
