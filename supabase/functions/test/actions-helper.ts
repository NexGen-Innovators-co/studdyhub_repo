


// Define schema for JSON response
export const AI_ACTION_SCHEMA = {
    type: "object",
    properties: {
        thought_process: { type: "string", description: "Reasoning for the actions" },
        actions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        description: "Action type. Supported: 'DB_ACTION', 'GENERATE_IMAGE', 'CREATE_RICH_POST', 'ENGAGE_SOCIAL', 'GENERATE_PODCAST', 'CREATE_GROUP', 'SCHEDULE_GROUP_EVENT'."
                    },
                    params: {
                        type: "object",
                        description: "Parameters for the action. For DB_ACTION: { table, operation, data, filters, order, limit }. Note: 'order' can be a string like 'column.asc' or 'column.desc', or an object { column, direction }. For GENERATE_IMAGE: { prompt }. For CREATE_RICH_POST: { content, privacy, group_id, media_json, image_url }."
                    }
                },
                required: ["type", "params"]
            }
        }
    },
    required: ["actions"]
};

// Helper to generate human-friendly descriptions for actions
export function getFriendlyActionLabel(actionType: string, params: any): string {
    switch (actionType) {
        case 'DB_ACTION':
            const table = params.table || 'database';
            const operation = params.operation || 'querying';
            const tableLabel = table.replace(/_/g, ' ');

            if (operation === 'SELECT') return `Searching ${tableLabel}`;
            if (operation === 'INSERT') return `Adding to ${tableLabel}`;
            if (operation === 'UPDATE') return `Updating ${tableLabel}`;
            if (operation === 'DELETE') return `Removing from ${tableLabel}`;
            return `Accessing ${tableLabel}`;

        case 'CREATE_RICH_POST': return "Creating a social post";
        case 'GENERATE_IMAGE': return "Generating artwork";
        case 'ENGAGE_SOCIAL': return "Interacting on social feed";
        case 'GENERATE_PODCAST': return "Generating AI podcast";
        case 'CREATE_GROUP': return `Creating study group ${params.name || ''}`;
        case 'SCHEDULE_GROUP_EVENT': return `Scheduling event ${params.title || ''}`;
        case 'CREATE_NOTE': return `Creating note ${params.title || ''}`;
        case 'UPDATE_NOTE': return `Updating note ${params.noteTitle || ''}`;
        case 'DELETE_NOTE': return `Deleting note ${params.noteTitle || ''}`;
        case 'CREATE_QUIZ': return `Preparing quiz ${params.title || ''}`;
        case 'UPDATE_USER_MEMORY': return "Saving learned facts to memory";
        case 'GENERATE_IMAGE': return "Creating visual content";
        default: return `Executing ${actionType.replace(/_/g, ' ').toLowerCase()}`;
    }
}

// Helper function to execute a single action
export async function runAction(actionsService: any, userId: string, sessionId: string, actionType: string, params: any): Promise<any> {
    let result: any;
    console.log(`[ActionExecution] running action helper: ${actionType}`);

    switch (actionType) {
        case 'DB_ACTION':
            console.log(`[ActionExecution] Generic DB Action: ${params.operation} on ${params.table}`);
            result = await actionsService.executeDbAction(
                userId,
                params.table,
                params.operation,
                params.data,
                params.filters,
                params.order,
                params.limit
            );
            break;

        case 'CREATE_RICH_POST':

            console.log(`[ActionExecution] Creating rich post`);
            let mediaFiles = [];

            // Handle media_json (legacy/structured)
            try {
                if (typeof params.media_json === 'string') mediaFiles = JSON.parse(params.media_json);
                else if (Array.isArray(params.media_json)) mediaFiles = params.media_json;
            } catch (e) { console.error("Error parsing media JSON", e); }

            // Handle image_url (new/shortcut for AI generated images)
            if (params.image_url && mediaFiles.length === 0) {
                mediaFiles.push({
                    url: params.image_url,
                    type: 'image',
                    mimeType: 'image/png'
                });
            }

            result = await actionsService.createRichSocialPost(userId, {
                content: params.content,
                privacy: params.privacy || 'public',
                groupId: params.group_id,
                mediaFiles: mediaFiles
            });
            break;

        case 'ENGAGE_SOCIAL':
            console.log(`[ActionExecution] Social engagement`);
            result = await actionsService.engageSocial(userId, {
                action: params.action,
                targetId: params.target_id,
                content: params.content
            });
            break;

        case 'GENERATE_PODCAST':
            console.log(`[ActionExecution] Generating podcast`);
            let sourceIds = [];
            try {
                if (Array.isArray(params.source_ids)) {
                    sourceIds = params.source_ids;
                } else {
                    sourceIds = params.source_ids.includes('[')
                        ? JSON.parse(params.source_ids)
                        : params.source_ids.split(',');
                }
            } catch (e) { sourceIds = []; }

            result = await actionsService.generatePodcast(userId, {
                title: params.title,
                sourceIds: sourceIds,
                style: params.style || 'casual'
            });
            break;

        case 'CREATE_GROUP':
            console.log(`[ActionExecution] Creating group`);
            result = await actionsService.createStudyGroup(userId, {
                name: params.name,
                description: params.description,
                category: params.category
            });
            break;

        case 'SCHEDULE_GROUP_EVENT':
            console.log(`[ActionExecution] Scheduling event`);
            result = await actionsService.scheduleGroupEvent(userId, {
                groupId: params.group_id,
                title: params.title,
                startTime: params.start_time,
                endTime: params.end_time
            });
            break;

        case 'CREATE_COURSE':
            console.warn('[ActionExecution] CREATE_COURSE action attempted by non-admin user. Skipping execution.');
            result = { success: false, error: 'Only admins can create courses. You can view available courses, but not create them.' };
            break;

        case 'GET_REFERRAL_CODE':
            result = await actionsService.getReferralCode(userId);
            break;

        case 'GENERATE_IMAGE':
            console.log(`[ActionExecution] Generating image: ${params.prompt}`);
            result = await actionsService.generateImage(userId, params.prompt);
            break;

        case 'CREATE_NOTE':
            console.log(`[ActionExecution] Creating note: ${params.title}`);
            result = await actionsService.createNote(userId, params);
            break;

        case 'UPDATE_NOTE':
            console.log(`[ActionExecution] Updating note: ${params.noteTitle}`);
            result = await actionsService.updateNote(userId, params.noteTitle, {
                title: params.title,
                content: params.content,
                category: params.category,
                tags: params.tags
            });
            break;

        case 'DELETE_NOTE':
            console.log(`[ActionExecution] Deleting note: ${params.noteTitle}`);
            result = await actionsService.deleteNote(userId, params.noteTitle);
            break;

        case 'LINK_DOCUMENT_TO_NOTE':
            console.log(`[ActionExecution] Linking document to note`);
            result = await actionsService.linkDocumentToNote(
                userId,
                params.noteTitle,
                params.documentTitle
            );
            break;

        case 'CREATE_FOLDER':
            console.log(`[ActionExecution] Creating folder: ${params.name}`);
            result = await actionsService.createDocumentFolder(userId, params);
            break;

        case 'ADD_DOCUMENT_TO_FOLDER':
            console.log(`[ActionExecution] Adding document to folder`);
            result = await actionsService.addDocumentToFolder(
                userId,
                params.documentTitle,
                params.folderName
            );
            break;

        case 'CREATE_SCHEDULE':
            console.log(`[ActionExecution] Creating schedule: ${params.title}`);
            result = await actionsService.createScheduleItem(userId, {
                title: params.title,
                subject: params.subject,
                type: params.type,
                start_time: params.start_time,
                end_time: params.end_time,
                description: params.description,
                location: params.location,
                color: params.color,
                is_recurring: params.is_recurring,
                recurrence_pattern: params.recurrence_pattern,
                recurrence_days: params.recurrence_days,
                recurrence_interval: params.recurrence_interval,
                recurrence_end_date: params.recurrence_end_date
            });
            break;

        case 'UPDATE_SCHEDULE':
            console.log(`[ActionExecution] Updating schedule item`);
            result = await actionsService.updateScheduleItem(
                userId,
                params.itemTitle,
                params.updates
            );
            break;

        case 'DELETE_SCHEDULE':
            console.log(`[ActionExecution] Deleting schedule item: ${params.itemTitle}`);
            result = await actionsService.deleteScheduleItem(userId, params.itemTitle);
            break;

        case 'CREATE_FLASHCARDS_FROM_NOTE':
            console.log(`[ActionExecution] Creating flashcards from note: ${params.noteTitle}`);
            result = await actionsService.createFlashcardsFromNote(
                userId,
                params.noteTitle,
                params.count
            );
            break;

        case 'CREATE_FLASHCARD':
            console.log(`[ActionExecution] Creating flashcard`);
            result = await actionsService.createFlashcard(userId, {
                front: params.front,
                back: params.back,
                category: params.category,
                difficulty: params.difficulty,
                hint: params.hint
            });
            break;

        case 'CREATE_LEARNING_GOAL':
            console.log(`[ActionExecution] Creating learning goal: ${params.goal_text}`);
            result = await actionsService.createLearningGoal(userId, {
                goal_text: params.goal_text,
                target_date: params.target_date,
                progress: params.progress,
                category: params.category
            });
            break;

        case 'UPDATE_LEARNING_GOAL':
            console.log(`[ActionExecution] Updating learning goal: ${params.goalText}`);
            result = await actionsService.updateLearningGoalProgress(
                userId,
                params.goalText,
                params.progress
            );
            break;

        case 'CREATE_QUIZ':
            console.log(`[ActionExecution] Creating quiz: ${params.title}`);
            // Generate questions logic
            let questions = params.questions;
            if (!questions || !Array.isArray(questions)) {
                questions = Array(params.question_count || 5).fill(0).map((_, i) => ({
                    question: `Question ${i + 1} about the topic?`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correct_answer: Math.floor(Math.random() * 4),
                    explanation: 'Explanation for the correct answer'
                }));
            }

            result = await actionsService.createQuiz(userId, {
                title: params.title,
                questions: questions,
                source_type: params.source_type,
                class_id: params.class_id
            });
            break;

        case 'RECORD_QUIZ_ATTEMPT':
            console.log(`[ActionExecution] Recording quiz attempt`);
            result = await actionsService.recordQuizAttempt(userId, params.quizTitle, {
                score: params.score,
                total_questions: params.total_questions,
                percentage: Math.round((params.score / params.total_questions) * 100),
                time_taken_seconds: params.time_taken_seconds,
                answers: [],
                xp_earned: params.xp_earned
            });
            break;

        case 'CREATE_RECORDING':
            console.log(`[ActionExecution] Creating recording: ${params.title}`);
            result = await actionsService.createClassRecording(userId, {
                title: params.title,
                subject: params.subject,
                duration: params.duration,
                transcript: params.transcript,
                summary: params.summary,
                document_title: params.document_title
            });
            break;

        case 'UPDATE_PROFILE':
            console.log(`[ActionExecution] Updating profile`);
            result = await actionsService.updateUserProfile(userId, params.updates);
            break;

        case 'UPDATE_STATS':
            console.log(`[ActionExecution] Updating stats`);
            result = await actionsService.updateUserStats(userId, params.updates);
            break;

        case 'AWARD_ACHIEVEMENT':
            console.log(`[ActionExecution] Awarding achievement: ${params.badgeName}`);
            result = await actionsService.awardAchievement(userId, params.badgeName);
            break;

        case 'UPDATE_USER_MEMORY':
            console.log(`[ActionExecution] Updating user memory`);
            result = await actionsService.updateUserMemory(userId, {
                fact_type: params.fact_type,
                fact_key: params.fact_key,
                fact_value: params.fact_value,
                confidence_score: params.confidence_score,
                source_session_id: sessionId
            });
            break;

        default:
            console.log(`[ActionExecution] Unknown action: ${actionType}`);
            result = { success: false, error: `Unknown action: ${actionType}` };
    }
    return result;
}

// Function to execute parsed actions from JSON
export async function executeParsedActions(
    actionsService: any,
    userId: string,
    sessionId: string,
    actions: any[],
    onProgress?: (action: any, index: number, total: number) => void
): Promise<any[]> {
    const executedActions: any[] = [];
    console.log(`[ActionExecution] Processing ${actions.length} parsed actions...`);

    const AUTO_EXECUTE_ENABLED = true;

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!AUTO_EXECUTE_ENABLED) {
            executedActions.push({
                type: action.type,
                params: action.params,
                result: null,
                success: true,
                status: 'proposed',
                timestamp: new Date().toISOString()
            });
            continue;
        }

        if (onProgress) {
            onProgress(action, i, actions.length);
        }

        try {
            console.log(`[ActionExecution] Executing action: ${action.type}`);
            const result = await runAction(actionsService, userId, sessionId, action.type, action.params);

            executedActions.push({
                type: action.type,
                success: result?.success || false,
                data: result,
                timestamp: new Date().toISOString()
            });

            console.log(`[ActionExecution] ${action.type}: ${result?.success ? 'SUCCESS' : 'FAILED'}`);

        } catch (error: any) {
            console.error(`[ActionExecution] Error executing action ${action.type}:`, error);
            executedActions.push({
                type: action.type,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    return executedActions;
}
