/**
 * Course AI Generation Service
 * 
 * Orchestrates AI-powered resource generation for courses.
 * Collects course document content, calls edge functions, saves
 * results to the database, and auto-links them as course_resources.
 */

import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types';

// ── Types ─────────────────────────────────────────────────

export type GenerationResourceType = 'quiz' | 'notes' | 'podcast' | 'flashcards';

export interface GenerationRequest {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  userId: string;
  userProfile: UserProfile;
  resourceTypes: GenerationResourceType[];
  options?: {
    quizNumQuestions?: number;
    quizDifficulty?: string;
    podcastStyle?: 'casual' | 'educational' | 'deep-dive';
    podcastDuration?: 'short' | 'medium' | 'long';
    flashcardCount?: number;
    flashcardDifficulty?: string;
  };
}

export interface GenerationProgress {
  type: GenerationResourceType;
  status: 'pending' | 'collecting' | 'generating' | 'saving' | 'done' | 'error';
  message: string;
  resourceId?: string;
}

type ProgressCallback = (progress: GenerationProgress[]) => void;

// ── Helpers ───────────────────────────────────────────────

/**
 * Collect all text content from documents linked to this course.
 * Merges content_extracted from `documents` table and content from
 * `course_materials` table.
 */
async function collectCourseContent(courseId: string): Promise<{
  combinedText: string;
  documentIds: string[];
  noteIds: string[];
}> {
  // 1. Get linked document resources
  const { data: docResources } = await supabase
    .from('course_resources')
    .select('resource_id')
    .eq('course_id', courseId)
    .eq('resource_type', 'document');

  const docIds = docResources?.map((r) => r.resource_id) ?? [];
  let combinedText = '';
  const documentIds: string[] = [];

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, title, content_extracted')
      .in('id', docIds);

    if (docs) {
      for (const doc of docs) {
        if (doc.content_extracted) {
          combinedText += `\n\n--- ${doc.title} ---\n${doc.content_extracted}`;
          documentIds.push(doc.id);
        }
      }
    }
  }

  // 2. Also include course_materials that have a linked document
  const { data: materials } = await supabase
    .from('course_materials')
    .select('id, title, document_id')
    .eq('course_id', courseId)
    .not('document_id', 'is', null);

  if (materials) {
    // Fetch the actual document content for materials not already in docIds
    const matDocIds = materials
      .map((m) => m.document_id!)
      .filter((id) => !docIds.includes(id));

    if (matDocIds.length > 0) {
      const { data: matDocs } = await supabase
        .from('documents')
        .select('id, title, content_extracted')
        .in('id', matDocIds);

      if (matDocs) {
        for (const doc of matDocs) {
          if (doc.content_extracted) {
            combinedText += `\n\n--- ${doc.title} ---\n${doc.content_extracted}`;
            documentIds.push(doc.id);
          }
        }
      }
    }
  }

  // 3. Get linked note resources
  const { data: noteResources } = await supabase
    .from('course_resources')
    .select('resource_id')
    .eq('course_id', courseId)
    .eq('resource_type', 'note');

  const noteIds = noteResources?.map((r) => r.resource_id) ?? [];

  if (noteIds.length > 0) {
    const { data: notes } = await supabase
      .from('notes')
      .select('id, title, content')
      .in('id', noteIds);

    if (notes) {
      for (const note of notes) {
        if (note.content) {
          combinedText += `\n\n--- ${note.title} ---\n${note.content}`;
        }
      }
    }
  }

  return { combinedText: combinedText.trim(), documentIds, noteIds };
}

/**
 * Insert a course_resources row to link a newly generated resource to the course.
 */
async function linkResourceToCourse(
  courseId: string,
  resourceType: string,
  resourceId: string,
  title: string,
  category?: string,
  isRequired?: boolean
) {
  const { error } = await supabase.from('course_resources').insert({
    course_id: courseId,
    resource_type: resourceType,
    resource_id: resourceId,
    title,
    category: category ?? 'AI Generated',
    is_required: isRequired ?? false,
  });

  if (error) {
    console.warn(`[courseAI] Failed to link ${resourceType} to course:`, error.message);
  }
}

// ── Generators ────────────────────────────────────────────

async function generateQuizForCourse(
  req: GenerationRequest,
  courseContent: string,
  updateProgress: (p: Partial<GenerationProgress>) => void
): Promise<string | null> {
  updateProgress({ status: 'generating', message: 'AI is creating quiz questions...' });

  // Truncate content for the quiz prompt
  const truncated = courseContent.substring(0, 8000);
  const numQuestions = req.options?.quizNumQuestions ?? 10;
  const difficulty = req.options?.quizDifficulty ?? 'medium';

  const { data, error } = await supabase.functions.invoke('generate-quiz', {
    body: {
      name: `${req.courseCode} Quiz`,
      transcript: truncated,
      num_questions: numQuestions,
      difficulty,
    },
  });

  if (error || !data?.questions?.length) {
    throw new Error(error?.message || 'AI generated no quiz questions');
  }

  updateProgress({ status: 'saving', message: 'Saving quiz...' });

  const quizTitle = data.title || `${req.courseCode} Quiz`;

  const { data: inserted, error: insertError } = await supabase
    .from('quizzes')
    .insert({
      title: quizTitle,
      questions: data.questions,
      user_id: req.userId,
      source_type: 'notes',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Failed to save quiz');
  }

  // Auto-link to course
  await linkResourceToCourse(req.courseId, 'quiz', inserted.id, quizTitle, 'Quiz');

  return inserted.id;
}

async function generateNotesForCourse(
  req: GenerationRequest,
  courseContent: string,
  updateProgress: (p: Partial<GenerationProgress>) => void
): Promise<string | null> {
  updateProgress({ status: 'generating', message: 'AI is generating study notes...' });

  if (!courseContent || courseContent.length < 50) {
    throw new Error('Not enough course content to generate notes. Upload documents first.');
  }

  // Use generate-inline-content (always deployed) to create notes from course text
  const prompt = `You are studdyhub, an expert AI learning assistant. Create comprehensive, well-structured study notes for the course "${req.courseCode} — ${req.courseTitle}". Include:

## Required Sections:
1. **Course Summary** — A concise overview
2. **Key Concepts** — The most important ideas, clearly explained
3. **Important Definitions** — Terms students must know
4. **Formulas / Processes** — Any key formulas, equations, or step-by-step processes
5. **Study Tips** — How to approach studying this material
6. **Quick Review Questions** — 3-5 self-check questions

Format as clean Markdown with proper headings, bullet points, and bold for emphasis.`;

  const { data, error } = await supabase.functions.invoke('generate-inline-content', {
    body: {
      selectedText: courseContent.substring(0, 12000),
      fullNoteContent: '',
      userProfile: req.userProfile,
      actionType: 'summarize',
      customInstruction: prompt,
    },
  });

  if (error || !data?.generatedContent) {
    throw new Error(error?.message || 'Failed to generate notes');
  }

  updateProgress({ status: 'saving', message: 'Saving notes...' });

  const noteTitle = `${req.courseCode} — AI Study Notes`;
  const { data: inserted, error: insertError } = await supabase
    .from('notes')
    .insert({
      user_id: req.userId,
      title: noteTitle,
      content: data.generatedContent,
      category: 'course',
      tags: [req.courseCode, 'ai-generated'],
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Failed to save notes');
  }

  await linkResourceToCourse(req.courseId, 'note', inserted.id, noteTitle, 'Study Notes');
  return inserted.id;
}

async function generatePodcastForCourse(
  req: GenerationRequest,
  documentIds: string[],
  noteIds: string[],
  updateProgress: (p: Partial<GenerationProgress>) => void
): Promise<string | null> {
  updateProgress({
    status: 'generating',
    message: 'AI is creating a podcast (this may take a minute)...',
  });

  const style = req.options?.podcastStyle ?? 'educational';
  const duration = req.options?.podcastDuration ?? 'medium';

  const { data, error } = await supabase.functions.invoke('generate-podcast', {
    body: {
      noteIds: noteIds.length > 0 ? noteIds : undefined,
      documentIds: documentIds.length > 0 ? documentIds : undefined,
      style,
      duration,
      podcastType: 'audio',
      numberOfHosts: 2,
    },
  });

  if (error) throw new Error(error.message || 'Failed to generate podcast');

  // generate-podcast saves to ai_podcasts table and returns the podcast data
  const podcastId = data?.id || data?.podcast?.id;
  const podcastTitle = data?.title || data?.podcast?.title || `${req.courseCode} Podcast`;

  if (podcastId) {
    updateProgress({ status: 'saving', message: 'Linking podcast to course...' });
    await linkResourceToCourse(req.courseId, 'podcast', podcastId, podcastTitle, 'Podcast');
    return podcastId;
  }

  // If no id returned, find the latest one for this user
  const { data: latestPodcast } = await supabase
    .from('ai_podcasts')
    .select('id, title')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestPodcast) {
    updateProgress({ status: 'saving', message: 'Linking podcast to course...' });
    await linkResourceToCourse(
      req.courseId,
      'podcast',
      latestPodcast.id,
      latestPodcast.title || podcastTitle,
      'Podcast'
    );
    return latestPodcast.id;
  }

  return null;
}

async function generateFlashcardsForCourse(
  req: GenerationRequest,
  courseContent: string,
  updateProgress: (p: Partial<GenerationProgress>) => void
): Promise<string | null> {
  updateProgress({ status: 'generating', message: 'AI is creating flashcards...' });

  const count = req.options?.flashcardCount ?? 20;
  const difficulty = req.options?.flashcardDifficulty ?? 'mixed';

  const { data, error } = await supabase.functions.invoke('generate-flashcards', {
    body: {
      noteContent: courseContent.substring(0, 8000),
      userProfile: req.userProfile,
      numberOfCards: count,
      difficulty,
    },
  });

  if (error || !data?.flashcards?.length) {
    throw new Error(error?.message || 'AI generated no flashcards');
  }

  updateProgress({ status: 'saving', message: `Saving ${data.flashcards.length} flashcards...` });

  // Flashcards are saved by the edge function if noteId is provided.
  // Since we don't have a noteId, save them manually.
  const flashcardRows = data.flashcards.map((fc: any) => ({
    user_id: req.userId,
    front: fc.front,
    back: fc.back,
    category: fc.category || req.courseCode,
    difficulty: fc.difficulty || 'medium',
    hint: fc.hint || null,
  }));

  const { error: insertError } = await supabase
    .from('flashcards')
    .insert(flashcardRows);

  if (insertError) {
    throw new Error(insertError.message || 'Failed to save flashcards');
  }

  // Flashcards don't have a single resource_id to link, but we can return success
  return 'flashcards-created';
}

// ── Main Orchestrator ─────────────────────────────────────

export async function generateCourseResources(
  req: GenerationRequest,
  onProgress: ProgressCallback
): Promise<void> {
  // Initialize progress for all requested types
  const progressMap = new Map<GenerationResourceType, GenerationProgress>();
  for (const type of req.resourceTypes) {
    progressMap.set(type, { type, status: 'pending', message: 'Waiting...' });
  }

  const emitProgress = () => {
    onProgress(Array.from(progressMap.values()));
  };

  const updateType = (type: GenerationResourceType, partial: Partial<GenerationProgress>) => {
    const current = progressMap.get(type)!;
    progressMap.set(type, { ...current, ...partial });
    emitProgress();
  };

  // Step 1: Collect all course content (shared across generators)
  for (const type of req.resourceTypes) {
    updateType(type, { status: 'collecting', message: 'Collecting course content...' });
  }

  const { combinedText, documentIds, noteIds } = await collectCourseContent(req.courseId);

  if (!combinedText && documentIds.length === 0 && noteIds.length === 0) {
    for (const type of req.resourceTypes) {
      updateType(type, {
        status: 'error',
        message: 'No course content found. Upload documents or add materials first.',
      });
    }
    return;
  }

  // Step 2: Generate each resource type sequentially to avoid rate limits
  for (const type of req.resourceTypes) {
    try {
      let resourceId: string | null = null;

      switch (type) {
        case 'quiz':
          resourceId = await generateQuizForCourse(req, combinedText, (p) =>
            updateType('quiz', p)
          );
          break;
        case 'notes':
          resourceId = await generateNotesForCourse(req, combinedText, (p) =>
            updateType('notes', p)
          );
          break;
        case 'podcast':
          resourceId = await generatePodcastForCourse(req, documentIds, noteIds, (p) =>
            updateType('podcast', p)
          );
          break;
        case 'flashcards':
          resourceId = await generateFlashcardsForCourse(req, combinedText, (p) =>
            updateType('flashcards', p)
          );
          break;
      }

      updateType(type, {
        status: 'done',
        message: 'Generated successfully!',
        resourceId: resourceId ?? undefined,
      });
    } catch (err: any) {
      updateType(type, {
        status: 'error',
        message: err.message || 'Generation failed',
      });
    }
  }
}
