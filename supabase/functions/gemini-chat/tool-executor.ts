// tool-executor.ts
// Thin dispatch layer between Gemini's native function calls and
// StuddyHubActionsService. Two dispatch paths:
//
//  1. toLegacyAction() — translates a native {name, args} call into the legacy
//     ReAct action format ({type, params}) so it can run through the existing
//     executeParsedActions pipeline. This is what keeps confirmation holding,
//     preflight SELECTs, duplicate checks, the pending-action ledger, bare
//     acceptance and decline working UNCHANGED for db_action writes.
//
//  2. executeDirectTool() — for tools with no legacy equivalent (currently
//     get_referral_code). Called straight against the service.

import type { StuddyHubActionsService } from './actions-service.ts';

export interface LegacyAction {
  type: string;
  params: any;
}

export function toLegacyAction(toolName: string, args: any): LegacyAction | null {
  const a = args || {};
  switch (toolName) {
    case 'search_web':
      return {
        type: 'WEB_SEARCH',
        params: { query: a.query, limit: a.maxResults ?? 4 }
      };
    case 'db_action':
      return {
        type: 'DB_ACTION',
        params: {
          table: a.table,
          operation: String(a.operation || 'SELECT').toUpperCase(),
          data: a.data ?? {},
          filters: a.filters ?? {},
          order: a.order ?? null,
          limit: a.limit ?? null
        }
      };
    case 'fetch_and_save_web_resource':
      return { type: 'FETCH_WEB_RESOURCE', params: { url: a.url, title: a.title || '' } };
    case 'generate_image':
      return { type: 'GENERATE_IMAGE', params: { prompt: a.prompt } };
    case 'engage_social':
      return { type: 'ENGAGE_SOCIAL', params: { action: a.action, targetId: a.targetId, content: a.content } };
    case 'create_social_post':
      // Post-shape params route through executeParsedActions' ENGAGE_SOCIAL
      // confirmation gate (posts must never publish without consent).
      return {
        type: 'ENGAGE_SOCIAL',
        params: { content: a.content, privacy: a.privacy || 'public', group_name: a.group_name ?? null }
      };

    // Content creation → DB_ACTION INSERTs (inherit the INSERT holding gate)
    case 'create_note':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'notes',
          operation: 'INSERT',
          data: {
            title: a.title,
            content: a.content || '',
            category: a.category || 'general',
            tags: Array.isArray(a.tags) ? a.tags : [],
            document_id: a.document_id ?? null,
            user_id: 'auth.uid()'
          }
        }
      };
    case 'create_flashcard':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'flashcards',
          operation: 'INSERT',
          data: {
            front: a.front,
            back: a.back,
            note_id: a.note_id ?? null,
            category: a.category || 'General',
            difficulty: a.difficulty || 'medium',
            hint: a.hint ?? null
          }
        }
      };
    case 'create_flashcards_from_note':
      return {
        type: 'GENERATE_FLASHCARDS',
        params: {
          noteTitle: a.noteTitle,
          count: a.count || 5
        }
      };
    case 'create_quiz':
      return {
        type: 'GENERATE_QUIZ',
        params: {
          topics: Array.isArray(a.topics) ? a.topics : (a.title ? [a.title] : ['General Knowledge']),
          focus_areas: Array.isArray(a.focus_areas) ? a.focus_areas : [],
          num_questions: a.num_questions || 8,
          difficulty: a.difficulty || 'auto',
          title: a.title || '',
          source_type: a.source_type || 'ai',
          class_id: a.class_id ?? null
        }
      };
    case 'create_schedule_item':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'schedule_items',
          operation: 'INSERT',
          data: {
            title: a.title,
            subject: a.subject,
            type: a.type,
            start_time: a.start_time,
            end_time: a.end_time,
            description: a.description || '',
            location: a.location || '',
            color: a.color || '#3B82F6',
            is_recurring: !!a.is_recurring,
            recurrence_pattern: a.recurrence_pattern ?? null,
            recurrence_days: Array.isArray(a.recurrence_days) ? a.recurrence_days : null,
            recurrence_end_date: a.recurrence_end_date ?? null,
            recurrence_interval: a.recurrence_interval ?? 1
          }
        }
      };
    case 'create_document_folder':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'document_folders',
          operation: 'INSERT',
          data: {
            name: a.name,
            description: a.description || '',
            color: a.color || '#3B82F6',
            parent_folder_name: a.parent_folder_name || null
          }
        }
      };
    case 'create_learning_goal':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'user_learning_goals',
          operation: 'INSERT',
          data: {
            goal_text: a.goal_text,
            target_date: a.target_date || null,
            progress: typeof a.progress === 'number' ? a.progress : 0,
            category: a.category || 'general'
          }
        }
      };
    case 'create_class_recording':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'class_recordings',
          operation: 'INSERT',
          data: {
            title: a.title,
            subject: a.subject,
            duration: a.duration,
            audio_url: a.audio_url || null,
            transcript: a.transcript || '',
            summary: a.summary || ''
          }
        }
      };
    case 'create_course':
      return {
        type: 'DB_ACTION',
        params: {
          table: 'courses',
          operation: 'INSERT',
          data: { code: a.code, title: a.title, description: a.description || '' }
        }
      };
    case 'generate_podcast':
      return {
        type: 'GENERATE_PODCAST',
        params: {
          title: a.title,
          noteIds: Array.isArray(a.sourceIds) ? a.sourceIds : (Array.isArray(a.noteIds) ? a.noteIds : []),
          documentIds: Array.isArray(a.documentIds) ? a.documentIds : [],
          style: a.style || 'educational',
          duration: a.duration || 'medium'
        }
      };

    // Destructive / editing → DELETE/UPDATE with title filters. These inherit
    // executeParsedActions' preflight SELECT + confirmation hold, so the user
    // sees "will affect N records" before anything is removed.
    case 'delete_note':
      return {
        type: 'DB_ACTION',
        params: { table: 'notes', operation: 'DELETE', filters: { title: a.noteTitle } }
      };
    case 'delete_schedule_item':
      return {
        type: 'DB_ACTION',
        params: { table: 'schedule_items', operation: 'DELETE', filters: { title: a.itemTitle } }
      };
    case 'update_note': {
      const updates: any = {};
      if (a.title !== undefined) updates.title = a.title;
      if (a.content !== undefined) updates.content = a.content;
      if (a.category !== undefined) updates.category = a.category;
      if (Array.isArray(a.tags)) updates.tags = a.tags;
      console.log('[ToolExecutor] update_note raw args:', JSON.stringify({ noteTitle: a.noteTitle, title: a.title, contentLen: (a.content || '').length, contentPreview: (a.content || '').slice(0, 100), category: a.category, hasTags: Array.isArray(a.tags) }));
      console.log('[ToolExecutor] update_note mapped updates:', JSON.stringify({ keys: Object.keys(updates), hasContent: 'content' in updates, contentLen: (updates.content || '').length }));
      return {
        type: 'DB_ACTION',
        params: { table: 'notes', operation: 'UPDATE', data: updates, filters: { title: a.noteTitle } }
      };
    }
    case 'update_schedule_item': {
      const updates: any = { ...(a.updates || {}) };
      for (const k of ['title', 'subject', 'type', 'start_time', 'end_time', 'description', 'location', 'color']) {
        if (a[k] !== undefined) updates[k] = a[k];
      }
      return {
        type: 'DB_ACTION',
        params: { table: 'schedule_items', operation: 'UPDATE', data: updates, filters: { title: a.itemIdOrTitle } }
      };
    }

    default:
      return null;
  }
}

/** Tools dispatched directly against the service (no legacy equivalent). */
export function isDirectTool(toolName: string): boolean {
  return toolName === 'get_referral_code';
}

export async function executeDirectTool(
  actions: StuddyHubActionsService,
  userId: string,
  toolName: string,
  args: any
): Promise<any> {
  try {
    switch (toolName) {
      case 'get_referral_code':
        return await actions.getReferralCode(userId);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
