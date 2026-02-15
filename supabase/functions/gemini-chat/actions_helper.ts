


// Define schema for JSON response
// Simplified AI actions schema: primary DB_ACTION plus generic utilities
export const AI_ACTION_SCHEMA = {
    type: 'object',
    properties: {
        thought_process: { type: 'string', description: 'Reasoning for actions' },
        actions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', description: "Action type. Supported: 'DB_ACTION', 'GENERATE_IMAGE', 'ENGAGE_SOCIAL'" },
                    params: { type: 'object', description: 'Parameters for the action' }
                },
                required: ['type', 'params']
            }
        }
    },
    required: ['actions']
};

// Helper to generate human-friendly descriptions for actions
export function getFriendlyActionLabel(actionType: string, params: any): string {
    if (actionType === 'DB_ACTION') {
        const table = params.table || 'database';
        const op = (params.operation || 'SELECT').toUpperCase();
        const tableLabel = table.replace(/_/g, ' ');
        switch (op) {
            case 'SELECT': return `Searching ${tableLabel}`;
            case 'INSERT': return `Adding to ${tableLabel}`;
            case 'UPDATE': return `Updating ${tableLabel}`;
            case 'DELETE': return `Removing from ${tableLabel}`;
            default: return `DB ${op} on ${tableLabel}`;
        }
    }
    if (actionType === 'GENERATE_IMAGE') return 'Generate image';
    if (actionType === 'ENGAGE_SOCIAL') return 'Social engagement';
    return actionType;
}

// Helper function to execute a single action
export async function runAction(actionsService: any, userId: string, sessionId: string, actionType: string, params: any): Promise<any> {
    console.log(`[ActionExecution] running action helper: ${actionType}`);
    try {
        if (actionType === 'DB_ACTION') {
            const { table, operation, data, filters, order, order_by, limit } = params || {};
            // Normalize: LLM sometimes generates "order_by" instead of "order"
            const resolvedOrder = order || order_by || null;
            return await actionsService.executeDbAction(userId, table, (operation || 'SELECT').toUpperCase(), data || {}, filters || {}, resolvedOrder, limit || null);
        }

        if (actionType === 'GENERATE_IMAGE') {
            if (!actionsService.generateImage) throw new Error('Image generation not implemented');
            return await actionsService.generateImage(userId, params.prompt || '');
        }

        if (actionType === 'ENGAGE_SOCIAL') {
            if (!actionsService.engageSocial) throw new Error('Social engagement not implemented');
            return await actionsService.engageSocial(userId, params || {});
        }

        return { success: false, error: `Unknown action type: ${actionType}` };
    } catch (err: any) {
        console.error('[actions_helper][runAction] Error executing action:', actionType, err);
        return { success: false, error: err?.message || String(err) };
    }
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
    // Track last inserted id for resolving placeholders like LAST_INSERT_ID
    let lastInsertId: string | number | null = null;
    let lastInsertedTable: string | null = null;

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

            // If this is a destructive DB action, perform a preflight SELECT to
            // fetch candidate row ids and require an explicit confirmation flag
            // (`params.confirmed === true`) before actually performing UPDATE/DELETE.
            if (action.type === 'DB_ACTION') {
                const { table, operation, filters } = action.params || {};
                const op = (operation || 'SELECT').toUpperCase();
                if ((op === 'UPDATE' || op === 'DELETE' )) {
                    try {
                        // Run a safe SELECT preflight to list matching ids
                        const preflightRes = await actionsService.executeDbAction(userId, table, 'SELECT', {}, filters || {}, null, 1000);
                        if (!preflightRes.success) {
                            executedActions.push({
                                type: action.type,
                                success: false,
                                data: { preflightError: preflightRes.error },
                                timestamp: new Date().toISOString()
                            });
                            console.log(`[ActionExecution] Preflight SELECT failed for ${action.type}`);
                            continue;
                        }

                        const rows = preflightRes.data || [];
                        const ids = Array.isArray(rows) ? rows.map((r: any) => r?.id).filter(Boolean) : [];

                        // If the caller did not explicitly confirm, return a needsConfirmation result
                        if (!action.params || action.params.confirmed !== true) {
                            executedActions.push({
                                type: action.type,
                                success: false,
                                data: { needsConfirmation: true, preflightIds: ids, rowCount: ids.length, params: action.params },
                                timestamp: new Date().toISOString()
                            });
                            console.log(`[ActionExecution] ${action.type} requires confirmation before proceeding`, { table, op, rowCount: ids.length });
                            continue;
                        }
                        // Otherwise, allow actual execution to proceed below
                    } catch (pfErr: any) {
                        console.error('[ActionExecution] Preflight check error:', pfErr);
                        executedActions.push({
                            type: action.type,
                            success: false,
                            data: { preflightException: pfErr?.message || String(pfErr) },
                            timestamp: new Date().toISOString()
                        });
                        continue;
                    }
                }
            }

            // Pre-process placeholder for social_media.post_id referencing previous insert
            if (action.type === 'DB_ACTION') {
                const { table, operation, data } = action.params || {};
                const op = (operation || 'SELECT').toUpperCase();

                // If this is an INSERT into social_media that references LAST_INSERT_ID,
                // resolve it to the actual ID from the previous social_posts insert when possible.
                if (table === 'social_media' && op === 'INSERT' && data && typeof data.post_id === 'string') {
                    const pid = String(data.post_id).trim();
                    const placeholders = ['LAST_INSERT_ID', '__LAST_INSERT_ID__', '"LAST_INSERT_ID"', "'LAST_INSERT_ID'"];
                    if (placeholders.includes(pid) || pid.toUpperCase().includes('LAST_INSERT_ID')) {
                        if (lastInsertId) {
                            action.params.data.post_id = lastInsertId;
                            console.log('[ActionExecution] Resolved social_media.post_id to lastInsertId', lastInsertId);
                        } else if (lastInsertedTable === 'social_posts') {
                            // If we previously inserted social_posts but did not capture id,
                            // attempt to extract it from the last executed action result.
                            const last = executedActions.slice().reverse().find((ea) => ea.type === 'DB_ACTION' && ea.data && ea.data.data);
                            try {
                                if (last && last.data && last.data.data) {
                                    const maybe = last.data.data;
                                    // result may be array or single object
                                    const resolvedId = Array.isArray(maybe) ? (maybe[0]?.id || maybe[0]?.post_id || null) : (maybe.id || maybe.post_id || null);
                                    if (resolvedId) {
                                        action.params.data.post_id = resolvedId;
                                        lastInsertId = resolvedId;
                                        console.log('[ActionExecution] Extracted post id from previous social_posts result', resolvedId);
                                    }
                                }
                            } catch (e) {
                                // ignore
                            }
                        }

                        // If we still don't have an id, skip executing this insert to avoid duplicate/erroneous writes
                        if (!action.params.data.post_id) {
                            console.log('[ActionExecution] No LAST_INSERT_ID available; skipping social_media insert to avoid duplicate writes');
                            executedActions.push({
                                type: action.type,
                                success: true,
                                data: { skipped: true, reason: 'No prior post id available; assume edge function handled media' },
                                timestamp: new Date().toISOString()
                            });
                            continue;
                        }
                    }
                }
            }

            const result = await runAction(actionsService, userId, sessionId, action.type, action.params);

            executedActions.push({
                type: action.type,
                success: result?.success || false,
                data: result,
                timestamp: new Date().toISOString()
            });

            // Capture last insert id when creating posts so subsequent media inserts can reference it
            try {
                if (action.type === 'DB_ACTION') {
                    const { table, operation } = action.params || {};
                    const op = (operation || 'SELECT').toUpperCase();
                    if (op === 'INSERT' && table === 'social_posts' && result && result.success && result.data) {
                        // result.data may be an array or object depending on execution path
                        const payload = result.data;
                        let extractedId: any = null;
                        if (Array.isArray(payload) && payload.length > 0) extractedId = payload[0]?.id || payload[0]?.post_id || null;
                        else if (payload && typeof payload === 'object') extractedId = payload.id || payload.post_id || (payload?.post?.id) || null;
                        if (extractedId) {
                            lastInsertId = extractedId;
                            lastInsertedTable = 'social_posts';
                            console.log('[ActionExecution] Captured lastInsertId from social_posts INSERT:', lastInsertId);
                        }
                    }
                }
            } catch (e) {
                // non-fatal
            }

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
