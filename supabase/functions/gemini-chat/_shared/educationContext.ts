// supabase/functions/_shared/educationContext.ts
// Server-side utility to fetch and format a user's education context
// for injection into AI prompts (Chat, Quiz generation, etc.).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ServerEducationContext {
  country: string | null;
  educationLevel: string | null;
  curriculum: string | null;
  targetExam: string | null;
  examDate: string | null;
  institution: string | null;
  yearOrGrade: string | null;
  subjects: string[];
}

/**
 * Fetches the resolved education context for a given user.
 * Returns null if no education profile exists.
 */
export async function getEducationContext(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string
): Promise<ServerEducationContext | null> {
  const { data, error } = await supabaseClient
    .from('user_education_profiles')
    .select(`
      institution_name,
      year_or_grade,
      country:countries ( name ),
      education_level:education_levels ( name ),
      curriculum:curricula ( name ),
      target_examination:examinations ( name, typical_date ),
      user_subjects ( subject:subjects ( name ) )
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    country: (data.country as any)?.name ?? null,
    educationLevel: (data.education_level as any)?.name ?? null,
    curriculum: (data.curriculum as any)?.name ?? null,
    targetExam: (data.target_examination as any)?.name ?? null,
    examDate: (data.target_examination as any)?.typical_date ?? null,
    institution: data.institution_name,
    yearOrGrade: data.year_or_grade,
    subjects: ((data.user_subjects as any[]) ?? [])
      .map((us: any) => us.subject?.name)
      .filter(Boolean),
  };
}

/**
 * Formats the education context into a concise text block
 * suitable for prepending to an AI system prompt.
 *
 * Example output:
 *   STUDENT CONTEXT:
 *   Country: Ghana
 *   Level: Senior High School (SHS)
 *   Curriculum: WASSCE
 *   Target Exam: WASSCE 2026 (June 2026)
 *   School: Achimota School
 *   Year: SHS 3
 *   Subjects: English Language, Mathematics (Core), Integrated Science, Social Studies, ...
 */
export function formatEducationContextForPrompt(
  ctx: ServerEducationContext
): string {
  const lines: string[] = ['STUDENT CONTEXT:'];

  if (ctx.country) lines.push(`Country: ${ctx.country}`);
  if (ctx.educationLevel) lines.push(`Level: ${ctx.educationLevel}`);
  if (ctx.curriculum) lines.push(`Curriculum: ${ctx.curriculum}`);
  if (ctx.targetExam) {
    const examLine = ctx.examDate
      ? `Target Exam: ${ctx.targetExam} (${ctx.examDate})`
      : `Target Exam: ${ctx.targetExam}`;
    lines.push(examLine);
  }
  if (ctx.institution) lines.push(`School: ${ctx.institution}`);
  if (ctx.yearOrGrade) lines.push(`Year: ${ctx.yearOrGrade}`);
  if (ctx.subjects.length > 0) {
    lines.push(`Subjects: ${ctx.subjects.join(', ')}`);
  }

  return lines.join('\n');
}
