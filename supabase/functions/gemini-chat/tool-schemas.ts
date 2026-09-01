// tool-schemas.ts
// One Gemini function-declaration per public async method on StuddyHubActionsService.
// Naming conventions (mirrors actions-service.ts signatures so the executor maps 1:1):
//   - Tool names are snake_case versions of the service method names.
//   - Discrete scalar arguments keep the service's exact argument name
//     (e.g. noteTitle, maxResults, badgeName).
//   - Single-object arguments are flattened to top-level properties using the
//     exact field names the service reads (e.g. start_time, privacy, groupId).
//   - userId is NEVER exposed to the model; it is injected server-side.

export const TOOL_SCHEMAS = [
  {
    name: "search_web",
    description:
      "Search the public internet for current information not available in the user's own notes/documents. Use this whenever the user asks to search, look up, google, browse, or find something online — regardless of exact phrasing (e.g. 'web search', 'search the web', 'look that up', 'check online'). Also use it when the user asks about recent events, news, or anything you cannot know from training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        maxResults: {
          type: "integer",
          description: "Max results to return",
          default: 4,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "db_action",
    description:
      "Create, update, delete, or query the user's own stored data (notes, documents, flashcards, quizzes, schedule items, learning goals, class recordings, podcasts, AI memory). Use for ANY request to save, remember, store, schedule, edit, remove, find, list, or retrieve the user's own content — including searching their documents ('search my documents', 'find that file'). Table names may be given as logical entities (note, document, flashcard, quiz, schedule, goal, memory) or real table names (notes, documents, flashcards, quizzes, schedule_items, user_learning_goals, ai_user_memory). UPDATE requires filters; DELETE requires filters; never guess an id — first SELECT by title/name to resolve it.",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description:
            "Logical entity or real table name: note(s), document(s), flashcard(s), quiz(zes), schedule/schedule_item/calendar_event, goal/user_learning_goal, recording/class_recording, podcast/ai_podcast, user_memory. Do NOT use information_schema.* or pg_catalog.*.",
        },
        operation: {
          type: "string",
          enum: ["INSERT", "UPDATE", "DELETE", "SELECT"],
        },
        data: {
          type: "object",
          description:
            "Row fields for INSERT/UPDATE (column-value pairs). auth.uid / user_id values are auto-replaced with the real user id.",
        },
        filters: {
          type: "object",
          description:
            "WHERE-clause-like column filters for UPDATE/DELETE/SELECT. Values support PostgREST operators as nested objects, e.g. { \"created_at\": { \"gte\": \"2026-01-01\" } } — operators: gte, lte, gt, lt, in, contains, ilike, neq ($ or _ prefixes also accepted). Special placeholder strings date.today_start / date.today_end resolve to today's UTC boundaries. Keys select/order/limit/offset/columns are ignored here.",
        },
        order: {
          type: "string",
          description:
            "SELECT only: sort specification, e.g. \"created_at.desc\" or \"created_at DESC\".",
        },
        limit: {
          type: "integer",
          description:
            "SELECT only: max rows to return (capped at 50; defaults to 10). Listings automatically strip heavy text columns and report total_count when more rows exist.",
        },
      },
      required: ["table", "operation"],
    },
  },
  {
    name: "fetch_and_save_web_resource",
    description:
      "Fetch a specific URL the user gave you and save it into their documents library. Only use when the user provides (or clearly points at) a concrete URL to import — for open-ended online lookups prefer search_web instead.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch and import",
        },
        title: {
          type: "string",
          description: "Optional display title for the saved document",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate an image from a text description (e.g. diagrams, illustrations for study material) and return its URL. Use when the user asks you to draw, illustrate, or generate a picture/diagram.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "create_note",
    description:
      "Create a new note in the user's notes library. Use for requests like 'save this as a note', 'make a note about X', 'write down Y'. Returns the created note.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Note title",
        },
        content: {
          type: "string",
          description: "Full note body text",
        },
        category: {
          type: "string",
          enum: ["general", "math", "science", "history", "language", "other"],
          description: "Subject category",
          default: "general",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for filtering",
        },
        document_id: {
          type: "string",
          description: "Optional id of a linked source document",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_note",
    description:
      "Edit an existing note identified by its title (exact match tried first, then partial case-insensitive match). Use for 'edit/change/update my note ...' AND for requests to add content to an existing note ('add diagrams/sections/examples to my X note'). If the requested addition is ambiguous (e.g. 'with diagrams'), you may ask one clarifying question first, but still call this tool once decided.",
    parameters: {
      type: "object",
      properties: {
        noteTitle: {
          type: "string",
          description: "Title of the note to edit (exact or partial)",
        },
        title: {
          type: "string",
          description: "New title",
        },
        content: {
          type: "string",
          description: "New body text",
        },
        category: {
          type: "string",
          description: "New category",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Replacement tag list",
        },
      },
      required: ["noteTitle"],
    },
  },
  {
    name: "delete_note",
    description:
      "Permanently delete one of the user's notes identified by title (exact or partial match). Destructive — only call when the user clearly asks to delete/remove a note.",
    parameters: {
      type: "object",
      properties: {
        noteTitle: {
          type: "string",
          description: "Title of the note to delete",
        },
      },
      required: ["noteTitle"],
    },
  },
  {
    name: "link_document_to_note",
    description:
      "Attach an existing document to an existing note so they are associated in the library. Both are identified by title.",
    parameters: {
      type: "object",
      properties: {
        noteTitle: {
          type: "string",
          description: "Title of the note to update",
        },
        documentTitle: {
          type: "string",
          description: "Title of the document to link",
        },
      },
      required: ["noteTitle", "documentTitle"],
    },
  },
  {
    name: "create_document_folder",
    description:
      "Create a folder used to organize the user's documents. Use for 'create a folder called X'.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Folder name",
        },
        description: {
          type: "string",
          description: "Optional folder description",
        },
        color: {
          type: "string",
          description: "Hex color, e.g. '#3B82F6'",
        },
        parent_folder_name: {
          type: "string",
          description: "Name of an existing parent folder to nest under",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "add_document_to_folder",
    description:
      "Move/file an existing document into an existing folder. Both identified by name/title.",
    parameters: {
      type: "object",
      properties: {
        documentTitle: {
          type: "string",
          description: "Title of the document",
        },
        folderName: {
          type: "string",
          description: "Name of the target folder",
        },
      },
      required: ["documentTitle", "folderName"],
    },
  },
  {
    name: "create_schedule_item",
    description:
      "Add an event to the user's study calendar/planner: classes, study sessions, assignments, exams. Use for 'schedule X', 'remind me to study Y on Z', 'put my exam on the calendar'. Times are ISO timestamps.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title",
        },
        subject: {
          type: "string",
          description: "School subject, e.g. 'Science'",
        },
        type: {
          type: "string",
          enum: ["class", "study", "assignment", "exam", "other"],
          description: "Kind of schedule item",
        },
        start_time: {
          type: "string",
          description: "ISO 8601 start timestamp",
        },
        end_time: {
          type: "string",
          description: "ISO 8601 end timestamp",
        },
        description: {
          type: "string",
          description: "Optional details",
        },
        location: {
          type: "string",
          description: "Optional venue or link",
        },
        color: {
          type: "string",
          description: "Hex color, e.g. '#3B82F6'",
        },
        is_recurring: {
          type: "boolean",
          description: "Whether the item repeats",
        },
        recurrence_pattern: {
          type: "string",
          description: "Human-readable pattern, e.g. 'weekly'",
        },
        recurrence_days: {
          type: "array",
          items: { type: "integer" },
          description:
            "Weekdays the item repeats on: 0=Sunday..6=Saturday (day names like 'monday' are also normalized). Required when is_recurring is true.",
        },
        recurrence_end_date: {
          type: "string",
          description: "ISO date the recurrence stops",
        },
        recurrence_interval: {
          type: "integer",
          description: "Repeat every N weeks (default 1)",
        },
      },
      required: ["title", "subject", "type", "start_time", "end_time"],
    },
  },
  {
    name: "update_schedule_item",
    description:
      "Edit an existing calendar/planner item. The item may be referenced by UUID id or by (fuzzy-matched) title. Use for 'move/reschedule/rename my study session'.",
    parameters: {
      type: "object",
      properties: {
        itemIdOrTitle: {
          type: "string",
          description: "UUID id or title of the schedule item to edit",
        },
        title: {
          type: "string",
          description: "New title",
        },
        subject: {
          type: "string",
          description: "New subject",
        },
        type: {
          type: "string",
          enum: ["class", "study", "assignment", "exam", "other"],
        },
        start_time: {
          type: "string",
          description: "ISO 8601 start timestamp",
        },
        end_time: {
          type: "string",
          description: "ISO 8601 end timestamp",
        },
        description: {
          type: "string",
        },
        location: {
          type: "string",
        },
        color: {
          type: "string",
        },
        is_recurring: {
          type: "boolean",
        },
        recurrence_pattern: {
          type: "string",
        },
        recurrence_days: {
          type: "array",
          items: { type: "integer" },
          description: "0=Sunday..6=Saturday",
        },
        recurrence_end_date: {
          type: "string",
        },
        recurrence_interval: {
          type: "integer",
        },
      },
      required: ["itemIdOrTitle"],
    },
  },
  {
    name: "delete_schedule_item",
    description:
      "Remove an event from the user's study calendar by title. Destructive — only call when the user clearly asks to cancel/delete a scheduled item.",
    parameters: {
      type: "object",
      properties: {
        itemTitle: {
          type: "string",
          description: "Title of the schedule item to delete",
        },
      },
      required: ["itemTitle"],
    },
  },
  {
    name: "create_quiz",
    description:
      "Generate an AI-powered quiz on a topic. The system handles question generation, validation, and storage. Use for 'make me a quiz on photosynthesis'.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Quiz title or topic (e.g. 'Photosynthesis', 'Chapter 5 Review')",
        },
        num_questions: {
          type: "integer",
          description: "Number of questions to generate (1-20, default 8)",
          default: 8,
        },
        difficulty: {
          type: "string",
          enum: ["easy", "auto", "hard"],
          description: "Difficulty level (auto = adaptive based on user performance)",
          default: "auto",
        },
        topics: {
          type: "array",
          items: { type: "string" },
          description: "Specific subtopics to focus on (optional, defaults to the title)",
        },
        source_type: {
          type: "string",
          enum: ["recording", "notes", "ai"],
          description: "Origin of the questions",
          default: "ai",
        },
        class_id: {
          type: "string",
          description: "Optional linked class/course id",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "record_quiz_attempt",
    description:
      "Record the result of a quiz the user completed and award XP. Identified by quiz title (fuzzy-matched).",
    parameters: {
      type: "object",
      properties: {
        quizTitle: {
          type: "string",
          description: "Title of the quiz that was taken",
        },
        score: {
          type: "integer",
          description: "Number of correct answers",
        },
        total_questions: {
          type: "integer",
          description: "Total number of questions",
        },
        percentage: {
          type: "number",
          description: "Score percentage 0-100",
        },
        time_taken_seconds: {
          type: "integer",
          description: "Duration of the attempt in seconds",
        },
        answers: {
          type: "array",
          items: { type: "object" },
          description: "Per-question answer records",
        },
        xp_earned: {
          type: "integer",
          description: "XP awarded for this attempt",
        },
      },
      required: [
        "quizTitle",
        "score",
        "total_questions",
        "percentage",
        "time_taken_seconds",
        "answers",
        "xp_earned",
      ],
    },
  },
  {
    name: "create_flashcards_from_note",
    description:
      "AI-generate revision flashcards from the content of one of the user's existing notes (by title). Uses the generate-flashcards edge function for high-quality, educationally-aligned flashcards. Use for 'make flashcards from my Photosynthesis note'.",
    parameters: {
      type: "object",
      properties: {
        noteTitle: {
          type: "string",
          description: "Title of the source note",
        },
        count: {
          type: "integer",
          description: "How many flashcards to generate (1-50)",
          default: 5,
        },
      },
      required: ["noteTitle"],
    },
  },
  {
    name: "create_flashcard",
    description:
      "Create a single flashcard with an explicit front and back. Use for 'make a flashcard asking X / answering Y'.",
    parameters: {
      type: "object",
      properties: {
        front: {
          type: "string",
          description: "Question/prompt side",
        },
        back: {
          type: "string",
          description: "Answer side",
        },
        note_id: {
          type: "string",
          description: "Optional linked note id",
        },
        category: {
          type: "string",
          description: "Category label",
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          default: "medium",
        },
        hint: {
          type: "string",
          description: "Optional hint shown during review",
        },
      },
      required: ["front", "back"],
    },
  },
  {
    name: "update_flashcard_review",
    description:
      "Record the outcome of reviewing one flashcard and reschedule its next review via SM-2 spaced repetition.",
    parameters: {
      type: "object",
      properties: {
        flashcardId: {
          type: "string",
          description: "UUID of the flashcard",
        },
        difficulty_rating: {
          type: "integer",
          description: "Self-rated difficulty 0-5 (SM-2 quality)",
        },
        correct: {
          type: "boolean",
          description: "Whether the user recalled it correctly",
        },
      },
      required: ["flashcardId", "difficulty_rating", "correct"],
    },
  },
  {
    name: "create_learning_goal",
    description:
      "Set a learning goal/target for the user, optionally with a deadline. Use for 'set a goal to finish X by Friday'.",
    parameters: {
      type: "object",
      properties: {
        goal_text: {
          type: "string",
          description: "What the user wants to achieve",
        },
        target_date: {
          type: "string",
          description: "ISO date to complete it by",
        },
        progress: {
          type: "integer",
          description: "Initial progress percent 0-100",
          default: 0,
        },
        category: {
          type: "string",
          description: "Goal category",
          default: "general",
        },
      },
      required: ["goal_text"],
    },
  },
  {
    name: "update_learning_goal_progress",
    description:
      "Update progress (0-100) on an existing learning goal identified by its text (exact or partial match). Reaching 100 marks it completed and grants bonus XP.",
    parameters: {
      type: "object",
      properties: {
        goalText: {
          type: "string",
          description: "Text of the goal to update",
        },
        progress: {
          type: "integer",
          description: "New progress percent 0-100",
        },
      },
      required: ["goalText", "progress"],
    },
  },
  {
    name: "create_class_recording",
    description:
      "Register a recorded lecture/class in the user's library with transcript and/or summary metadata.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        subject: {
          type: "string",
        },
        duration: {
          type: "integer",
          description: "Duration in seconds",
        },
        audio_url: {
          type: "string",
          description: "Storage path or URL of the audio",
        },
        transcript: {
          type: "string",
        },
        summary: {
          type: "string",
        },
        document_title: {
          type: "string",
          description: "Title of an existing document to link",
        },
      },
      required: ["title", "subject", "duration"],
    },
  },
  {
    name: "update_user_stats",
    description:
      "Update the user's gamification stats. Counter-style fields (total_xp, total_quizzes_attempted, total_quizzes_completed, total_study_time_seconds) are INCREMENTED by the given amounts; other fields are set/merged; level is recalculated from XP. Prefer not to call this directly — it is applied automatically by quiz attempts and achievements.",
    parameters: {
      type: "object",
      properties: {
        total_xp: {
          type: "integer",
          description: "XP to ADD",
        },
        level: {
          type: "integer",
        },
        current_streak: {
          type: "integer",
        },
        longest_streak: {
          type: "integer",
        },
        total_quizzes_attempted: {
          type: "integer",
          description: "Count to ADD",
        },
        total_quizzes_completed: {
          type: "integer",
          description: "Count to ADD",
        },
        average_score: {
          type: "number",
        },
        total_study_time_seconds: {
          type: "integer",
          description: "Seconds to ADD",
        },
        weak_areas: {
          type: "array",
          items: { type: "string" },
        },
        badges_earned: {
          type: "array",
          items: { type: "string" },
          description: "Badge names merged into earned set",
        },
      },
    },
  },
  {
    name: "update_user_profile",
    description:
      "Update the user's profile preferences (learning style/preferences, quiz preferences, public visibility). Use when the user states a durable preference like 'I learn better with visuals'.",
    parameters: {
      type: "object",
      properties: {
        learning_style: {
          type: "string",
        },
        learning_preferences: {
          type: "object",
        },
        quiz_preferences: {
          type: "object",
        },
        is_public: {
          type: "boolean",
        },
      },
    },
  },
  {
    name: "create_social_post",
    description:
      "Publish a post to the StuddyHub social feed on behalf of the user. Externally visible — only call on an explicit request to post/share.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Post text",
        },
        privacy: {
          type: "string",
          enum: ["public", "followers", "private"],
          default: "public",
        },
        group_name: {
          type: "string",
          description: "Optional group name to post into",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "create_rich_social_post",
    description:
      "Publish a social feed post with media attachments (images/video/documents). Externally visible — only call on an explicit request.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Post text",
        },
        privacy: {
          type: "string",
          enum: ["public", "followers", "private"],
        },
        groupId: {
          type: "string",
          description: "Optional group id to post into",
        },
        mediaFiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              type: {
                type: "string",
                enum: ["image", "video", "document"],
              },
              mimeType: { type: "string" },
            },
            required: ["url", "type", "mimeType"],
          },
          description: "Media attachments for the post",
        },
      },
      required: ["content", "privacy"],
    },
  },
  {
    name: "engage_social",
    description:
      "Like or comment on an existing social post on behalf of the user. content is required when action is 'comment'.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["like", "comment"],
        },
        targetId: {
          type: "string",
          description: "Id of the post to interact with",
        },
        content: {
          type: "string",
          description: "Comment text (required for action='comment')",
        },
      },
      required: ["action", "targetId"],
    },
  },
  {
    name: "award_achievement",
    description:
      "Award a named badge to the user and grant its XP reward. Use sparingly and only when the user genuinely earns it; badge must exist in the badges table.",
    parameters: {
      type: "object",
      properties: {
        badgeName: {
          type: "string",
          description: "Exact badge name from the badges table",
        },
      },
      required: ["badgeName"],
    },
  },
  {
    name: "update_user_memory",
    description:
      "Store a durable fact about the user (preference, learning style, personal fact, skill level, interest) in long-term AI memory, or reinforce an identical existing fact. Use for 'remember that I ...'.",
    parameters: {
      type: "object",
      properties: {
        fact_type: {
          type: "string",
          enum: [
            "preference",
            "learning_style",
            "personal_fact",
            "skill_level",
            "interest",
          ],
        },
        fact_key: {
          type: "string",
          description: "Short stable key, e.g. 'favorite_subject'",
        },
        fact_value: {
          type: "string",
          description: "The fact itself, e.g. 'Science'",
        },
        confidence_score: {
          type: "number",
          description: "0-1 confidence (default 0.7)",
        },
        source_session_id: {
          type: "string",
          description: "Session the fact came from (usually omitted)",
        },
      },
      required: ["fact_type", "fact_key", "fact_value"],
    },
  },
  {
    name: "generate_podcast",
    description:
      "Start generating an AI podcast episode from the user's saved sources (notes/documents/recordings). Runs asynchronously in the background — tell the user it is processing. Resource-intensive — only on explicit request.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Episode title",
        },
        sourceIds: {
          type: "array",
          items: { type: "string" },
          description: "Ids of the user's sources to base the episode on",
        },
        style: {
          type: "string",
          enum: ["casual", "educational", "deep-dive"],
        },
      },
      required: ["title", "sourceIds", "style"],
    },
  },
  {
    name: "create_study_group",
    description:
      "Create a public study group and make the user its admin. Externally visible to other users — only on explicit request.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
        category: {
          type: "string",
        },
      },
      required: ["name", "description", "category"],
    },
  },
  {
    name: "schedule_group_event",
    description:
      "Schedule an online event for an existing study group; the organizer is auto-marked attending.",
    parameters: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "Id of the group",
        },
        title: {
          type: "string",
        },
        startTime: {
          type: "string",
          description: "ISO 8601 start timestamp",
        },
        endTime: {
          type: "string",
          description: "ISO 8601 end timestamp",
        },
      },
      required: ["groupId", "title", "startTime", "endTime"],
    },
  },
  {
    name: "create_course",
    description:
      "Register a new course the user is studying.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
        },
        title: {
          type: "string",
        },
        description: {
          type: "string",
        },
      },
      required: ["code", "title"],
    },
  },
  {
    name: "get_referral_code",
    description:
      "Look up (or generate if missing) the user's referral code. No arguments needed.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
] as const;

// Same declarations in OpenAI chat-completions tool format, so non-Gemini
// backends (Groq / OpenRouter) can drive the exact same tool set.
export function toOpenAIDeclarations(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOL_SCHEMAS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));
}
