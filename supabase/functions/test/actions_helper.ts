


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
    // console.log(`[ActionExecution] running action helper: ${actionType}`);
    try {
        if (actionType === 'DB_ACTION') {
            const { table, operation, data, filters, order, limit } = params || {};
            return await actionsService.executeDbAction(userId, table, (operation || 'SELECT').toUpperCase(), data || {}, filters || {}, order || null, limit || null);
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
        // console.error('[actions_helper][runAction] Error executing action:', actionType, err);
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
    // console.log(`[ActionExecution] Processing ${actions.length} parsed actions...`);

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
            // console.log(`[ActionExecution] Executing action: ${action.type}`);
            const result = await runAction(actionsService, userId, sessionId, action.type, action.params);

            executedActions.push({
                type: action.type,
                success: result?.success || false,
                data: result,
                timestamp: new Date().toISOString()
            });

            // console.log(`[ActionExecution] ${action.type}: ${result?.success ? 'SUCCESS' : 'FAILED'}`);

        } catch (error: any) {
            // console.error(`[ActionExecution] Error executing action ${action.type}:`, error);
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

