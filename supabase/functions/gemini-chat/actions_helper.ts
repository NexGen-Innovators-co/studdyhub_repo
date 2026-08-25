


// Define schema for JSON response
// Simplified AI actions schema: primary DB_ACTION plus generic utilities
export const AI_ACTION_SCHEMA = {
    type: 'object',
    properties: {
        thought_process: { type: 'string' },
        actions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    params: {
                        type: 'object',
                        properties: {
                            table: { type: 'string' },
                            operation: { type: 'string' },
                            data: { type: 'object' },
                            filters: { type: 'object' },
                            order: { 
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'object', properties: { column: { type: 'string' }, direction: { type: 'string' } } }
                                ]
                            },
                            limit: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
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
    if (actionType === 'WEB_SEARCH') return `Searching web for "${params?.query || 'topic'}"`;
    if (actionType === 'FETCH_WEB_RESOURCE') return `Importing web resource`;
    return actionType;
}

// Helper function to execute a single action
export async function runAction(actionsService: any, userId: string, sessionId: string, actionType: string, params: any): Promise<any> {
    console.log(`[ActionExecution] running action helper: ${actionType}`);
    try {
        if (actionType === 'DB_ACTION') {
            const p = params || {};
            if (p.operation === 'INSERT' && p.filters && !p.data) {
              // The planner put the payload in filters – move it.
              p.data = p.filters;
              p.filters = {};
            }
            const resolvedTable = p.table || p.tableName || p.table_name || p.relation || p.targetTable || p.target_table || '';
            const rawOp = p.operation || p.op || p.action || 'SELECT';
            const resolvedOp = String(rawOp).toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
            const resolvedData = p.data || p.payload || p.values || p.record || {};
            // The planner nests paging/selection controls inside `query`:
            //   query: { select: "*", order: { column, ascending }, limit: 5, user_id: ... }
            // select/order/limit/offset are query controls, NOT column filters —
            // feeding them to applyFiltersToQuery corrupts the URL (PGRST100
            // 'failed to parse order (eq.[object Object])'). Split them out and
            // hand the paging controls to executeDbAction's dedicated args.
            const rawFilters = p.filters || p.filter || p.where || p.query || {};
            // Guard: the planner occasionally emits junk (strings/arrays) for
            // filters — destructuring a non-object would produce a garbage
            // numeric-keyed object that applyFiltersToQuery then .eq()s against.
            const isPlainFilterObject = rawFilters !== null && typeof rawFilters === 'object' && !Array.isArray(rawFilters);
            const { select: _qSelect, order: _qOrder, orderBy: _qOrderBy, order_by: _qOrderBySnake, limit: _qLimit, offset: _qOffset, columns: _qCols, ...filterRest } = isPlainFilterObject ? rawFilters : ({} as any);
            const resolvedFilters = filterRest;
            const resolvedOrder = p.order || p.order_by || p.orderBy || _qOrder || _qOrderBy || _qOrderBySnake || null;
            const resolvedLimit = p.limit != null ? Number(p.limit) : (_qLimit != null ? Number(_qLimit) : null);

            return await actionsService.executeDbAction(
                userId,
                resolvedTable,
                resolvedOp,
                resolvedData,
                resolvedFilters,
                resolvedOrder,
                resolvedLimit
            );
        }

        if (actionType === 'GENERATE_IMAGE') {
            if (!actionsService.generateImage) throw new Error('Image generation not implemented');
            return await actionsService.generateImage(userId, params.prompt || '');
        }

        if (actionType === 'ENGAGE_SOCIAL') {
            // Determine whether this is a post creation or a simple like/comment
            // The model may emit a variety of shapes; support both the documented
            // `handler: "create-social-post"` pattern as well as the older
            // `content`/`privacy` payload.  Fallback to engageSocial for likes/comments.
            const p = params || {};

            const isLikeComment = p.action === 'like' || p.action === 'comment';
            const isPost = !isLikeComment && (p.handler === 'create-social-post' || typeof p.content === 'string');

            if (isPost) {
                if (!actionsService.createSocialPost) throw new Error('Social post creation not implemented');
                // normalize payload
                let postData: any;
                if (p.handler === 'create-social-post' && p.data) {
                    postData = p.data;
                } else {
                    postData = {
                        content: p.content || '',
                        privacy: p.privacy || 'public',
                        group_name: p.group_name || null
                    };
                }
                return await actionsService.createSocialPost(userId, postData);
            }

            // otherwise treat it as a standard like/comment
            if (!actionsService.engageSocial) throw new Error('Social engagement not implemented');
            return await actionsService.engageSocial(userId, params || {});
        }

        if (actionType === 'CALCULATOR') {
            // V2: safe arithmetic evaluator — the expression is regex-whitelisted
            // to digits/operators/parens only (letters, brackets and quotes are
            // stripped) before evaluation, so this cannot execute arbitrary code.
            const expr = String(params.expression || params.expr || params.query || '').trim();
            const sanitized = expr
                .replace(/\^/g, '**')
                .replace(/[^0-9+\-*/().%\s]/g, '')
                .replace(/\*\*/g, '^'); // stash ** then re-allow
            const safe = sanitized.replace(/\^/g, '**');
            if (!safe || !/^[0-9+\-*/().%\s]+$/.test(safe)) {
                return { success: false, error: 'CALCULATOR: unsafe or empty arithmetic expression.' };
            }
            try {
                // eslint-disable-next-line no-new-func
                const value = Function(`"use strict"; return (${safe});`)();
                if (typeof value === 'number' && isFinite(value)) {
                    return { success: true, value, expression: expr };
                }
                return { success: false, error: 'CALCULATOR: expression did not evaluate to a finite number.' };
            } catch (calcErr: any) {
                return { success: false, error: `CALCULATOR failed: ${calcErr?.message || String(calcErr)}` };
            }
        }

        if (actionType === 'WEB_SEARCH') {
            const query = String(params.query || params.searchQuery || params.q || '').trim();
            const limit = params.limit ? Number(params.limit) : 4;
            return await actionsService.searchWeb(query, limit);
        }

        if (actionType === 'FETCH_WEB_RESOURCE') {
            const url = String(params.url || params.link || '').trim();
            const title = params.title || '';
            return await actionsService.fetchAndSaveWebResource(userId, { url, title });
        }

        return { success: false, error: `Unknown action type: ${actionType}` };
    } catch (err: any) {
        console.error('[actions_helper][runAction] Error executing action:', actionType, err);
        return { success: false, error: err?.message || String(err) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION LEDGER (P0-1 / P0-3)
//
// Server-side enforcement for write actions. A `confirmed: true` flag emitted
// by the planner is ONLY honored when ALL of the following hold:
//   (a) the user's CURRENT message is an explicit confirmation
//   (b) an action with a matching signature is genuinely pending confirmation
//       in the session's recent conversation_context
// This closes the bug class where the model self-attests `confirmed: true` on
// brand-new proposals (unconfirmed second INSERTs, unconfirmed DELETEs, etc.)
// and where a stale "awaiting confirmation" state leaks into unrelated turns.
// ─────────────────────────────────────────────────────────────────────────────

export function canonicalizeForSignature(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        const keys = Object.keys(v).sort();
        return keys.map(k => `${k}:${canonicalizeForSignature((v as any)[k])}`).join('|');
    }
    return String(v);
}

export function normalizeAuthUid(v: any): any {
    if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (lower === 'auth.uid' || lower === 'auth.uid()' || lower === 'user_id' || lower === 'current_user') return '__AUTH_UID__';
        return v;
    }
    if (Array.isArray(v)) return v.map(normalizeAuthUid);
    if (v && typeof v === 'object') {
        const out: any = {};
        for (const k of Object.keys(v)) out[k] = normalizeAuthUid((v as any)[k]);
        return out;
    }
    return v;
}

export function buildActionSignature(table: string, op: string, data: any, filters: any): string {
    const t = String(table || '').toLowerCase();
    const o = String(op || '').toUpperCase();
    if (o === 'INSERT') return `${t}|INSERT|${canonicalizeForSignature(normalizeAuthUid(data || {}))}`;
    return `${t}|${o}|${canonicalizeForSignature(normalizeAuthUid(filters || {}))}`;
}

/**
 * All signature variants a pending action can be confirmed under. Includes the
 * exact signature plus lenient title/id variants so a re-emitted action that
 * resolves a title to an id (or re-sends a proposal with light edits) still
 * matches the pending confirmation instead of double-asking.
 */
export function pendingSignatureVariants(table: string, op: string, data: any, filters: any, preflightIds: string[] = []): string[] {
    const variants = [buildActionSignature(table, op, data, filters)];
    const o = String(op || '').toUpperCase();
    const t = String(table || '').toLowerCase();
    if (o === 'UPDATE' || o === 'DELETE') {
        for (const id of (preflightIds || [])) {
            if (id) variants.push(`${t}|${o}|id:${id}`);
        }
        const title = (filters as any)?.title;
        if (typeof title === 'string' && title.trim()) {
            variants.push(`${t}|${o}|title:${canonicalizeForSignature(normalizeAuthUid(title.trim()))}`);
        }
    } else if (o === 'INSERT') {
        const d = (data || {}) as any;
        const title = d.title || d.name || d.front;
        if (typeof title === 'string' && title.trim()) {
            variants.push(`${t}|INSERT|title:${canonicalizeForSignature(normalizeAuthUid(title.trim()))}`);
        }
    }
    return variants;
}

function unwrapConversationContext(ctx: any): any {
    let c = ctx;
    let guard = 0;
    while (typeof c === 'string' && guard++ < 5) {
        try {
            const parsed = JSON.parse(c);
            if (parsed === c) break;
            c = parsed;
        } catch (_) { break; }
    }
    return c;
}

/**
 * Scans recent messages for an assistant turn that is awaiting confirmation
 * and collects the signature variants of every held action.
 */
export function extractPendingConfirmationInfo(recentMessages: any[]): { hasPending: boolean; signatures: Set<string>; malformed: boolean } {
    const signatures = new Set<string>();
    let hasPending = false;
    let malformed = false;
    for (const msg of (recentMessages || [])) {
        if (msg?.role !== 'assistant' && msg?.role !== 'model') continue;
        const ctx = unwrapConversationContext(msg.conversation_context);
        if (!ctx || typeof ctx !== 'object') continue;
        if (ctx.awaitingConfirmation) hasPending = true;
        if (!Array.isArray(ctx.pendingActions)) continue;
        hasPending = true;
        for (const a of ctx.pendingActions) {
            if (!a) continue;
            const d = a.data || {};
            // FIX (poisoned batch): batches held before the identity-stub fix stored
            // bare stubs ({heldInBatch:true, needsConfirmation:true}) for every action
            // after the first, so their signatures can't be rebuilt and a confirmation
            // would only execute ONE item. Flag the whole batch malformed so the next
            // confirmation turn re-plans from scratch and confirms the re-proposed
            // actions wholesale instead of trusting the partial ledger.
            if (d.heldInBatch && !d.table && !d.operation) {
                malformed = true;
                continue;
            }
            const params = d.params || {};
            if (a.type === 'DB_ACTION') {
                const table = params.table || d.table;
                const op = params.operation || d.operation;
                const data = params.data || d.proposedData || {};
                const filters = params.filters || d.filters || {};
                const preflightIds = Array.isArray(d.preflightIds) ? d.preflightIds : [];
                for (const sig of pendingSignatureVariants(table, op, data, filters, preflightIds)) signatures.add(sig);
            } else {
                // Non-DB actions (e.g. social post creation) match on the full payload.
                signatures.add(`${a.type}|POST|${canonicalizeForSignature(normalizeAuthUid(params || d.proposedData || {}))}`);
            }
        }
    }
    return { hasPending, signatures, malformed };
}

const CONFIRMATION_DECLINE_RE = /^(no|nope|cancel|don'?t|dont|stop|never mind|not now)\b/i;

export function isExplicitConfirmationMessage(message: string): boolean {
    if (!message) return false;
    const t = message.trim();
    if (!t) return false;
    if (CONFIRMATION_DECLINE_RE.test(t)) return false;
    return /(^|\b)(yes|yeah|yep|yup|sure|ok|okay|proceed|go ahead|do it|correct|confirm|please|sounds good)(\b|$|[,.!?\s])/i.test(t)
        || /^[👍✅✔️✓]/.test(t);
}

/**
 * True when the user's message is an explicit decline / cancellation of the
 * pending action ("no", "cancel", "don't", "stop", "never mind").
 */
export function isConfirmationDeclineMessage(message: string): boolean {
    if (!message) return false;
    return CONFIRMATION_DECLINE_RE.test(message.trim());
}

/**
 * P0-3: deterministic requestOrigin — an explicit save verb in the user's own
 * message wins over whatever the planner guessed.
 */
export function deriveRequestOrigin(message: string): string {
    if (!message) return 'inferred';
    if (/\b(save|store|keep|create|add|record|jot down|make a note|remember this|log this)\b/i.test(message)) return 'explicit';
    return 'inferred';
}

/**
 * True only when the action's `confirmed: true` can be trusted: the user's
 * current message is an explicit confirmation AND at least one of the action's
 * signature variants is pending confirmation in the session.
 */
export function confirmationMatchesPending(
    params: any,
    ctx: { pendingSignatures?: Set<string>; userConfirmationIntent?: boolean; malformed?: boolean } | undefined,
    variants: string[]
): boolean {
    if (!params) return false;
    if (!ctx) return false;                                    // no ledger context → never trust self-attested confirmed
    if (ctx.userConfirmationIntent !== true) return false;     // current message must be an explicit confirmation
    // FIX (poisoned batch): a malformed pending batch (identity-less stubs) can't be
    // signature-matched — the user's explicit confirmation is the trust basis, so
    // accept the re-proposed action wholesale (repair mode). Scoped to INSERTs: the
    // malformed shape only ever originates from the INSERT batch-hold path, so an
    // UPDATE/DELETE re-proposed on the same turn must still be held (it will
    // self-heal through the normal confirmation flow with full identity).
    if (ctx.malformed === true && String(params.operation || '').toUpperCase() === 'INSERT') return true;
    const sigs = ctx.pendingSignatures;
    if (!sigs || sigs.size === 0) return false;                // nothing pending → self-attestation
    // The action must genuinely match what was held for confirmation. The ledger
    // above (scoped to the most recent assistant turn) plus the user's explicit
    // confirmation THIS turn is the trust basis — `confirmed: true` is the
    // planner's normal signal, but some models forget to attach it. Requiring the
    // flag when the ledger already proves (pending action + user said yes) would
    // re-hold the confirmed action and loop the ask forever (the accept → re-ask bug).
    if (variants.some(v => sigs.has(v))) return true;
    // Custom-instruction confirmations: the user explicitly confirmed THIS turn
    // and the planner re-emitted the approved action with refinements (e.g. a
    // title change) — its exact signature no longer matches the held one, but it
    // is the same table+INSERT the user just approved. Accept it so a
    // "yes, but change X" reply executes instead of re-asking forever. Scoped to
    // INSERT (creates are recoverable); UPDATE/DELETE must still match a held
    // signature exactly, because a broadened destructive filter must never slip
    // through on a loose table/op match.
    if (String(params.operation || '').toUpperCase() === 'INSERT') {
        const t = String(params.table || '').toLowerCase();
        if (!t) return false;
        for (const s of sigs) {
            const p = String(s).split('|');
            if (p.length >= 2 && p[0] === t && p[1] === 'INSERT') return true;
        }
    }
    return false;
}

// Function to execute parsed actions from JSON
export async function executeParsedActions(
    actionsService: any,
    userId: string,
    sessionId: string,
    actions: any[],
    onProgress?: (action: any, index: number, total: number) => void,
    confirmationContext?: { pendingSignatures?: Set<string>; userConfirmationIntent?: boolean; userMessage?: string; malformed?: boolean }
): Promise<any[]> {
    const executedActions: any[] = [];
    console.log(`[ActionExecution] Processing ${actions.length} parsed actions...`);

    const AUTO_EXECUTE_ENABLED = true;
    // Track last inserted id for resolving placeholders like LAST_INSERT_ID
    let lastInsertId: string | null = null;
    let lastInsertedTable: string | null = null;
    
    // Batch tracking for multi-row operations
    let insertCountByTable: Record<string, number> = {};
    let batchNeedsConfirmationReturned = false;

    // First pass: count INSERTs per table to detect batches
    for (const act of actions) {
        if (act.type === 'DB_ACTION' && act.params?.operation?.toUpperCase() === 'INSERT') {
            const t = act.params.table;
            if (t) {
                insertCountByTable[t] = (insertCountByTable[t] || 0) + 1;
            }
        }
    }

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

            // If this is a social post creation, we treat it like a destructive operation
            // from a confirmation perspective even though it does not modify existing data.
            // Posts should not be published without explicit user permission.
            if (action.type === 'ENGAGE_SOCIAL') {
                const p = action.params || {};
                // detect if it's a new-post request (not a simple like/comment)
                const isLikeComment = p.action === 'like' || p.action === 'comment';
                const isPost = !isLikeComment && (p.handler === 'create-social-post' || typeof p.content === 'string');
                const postVariants = [`ENGAGE_SOCIAL|POST|${canonicalizeForSignature(normalizeAuthUid(p.data || p))}`];
                if (isPost && !confirmationMatchesPending(p, confirmationContext, postVariants)) {
                    executedActions.push({
                        type: action.type,
                        success: false,
                        data: { needsConfirmation: true, params: action.params },
                        timestamp: new Date().toISOString()
                    });
                    console.log(`[ActionExecution] ${action.type} requires confirmation before posting`, action.params);
                    continue;
                }
            }

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

                        // If the confirmation is not backed by a genuinely pending action
                        // + an explicit user confirmation this turn, hold for confirmation.
                        const confirmVariants = pendingSignatureVariants(table, op, {}, filters || {}, ids);
                        if (!confirmationMatchesPending(action.params, confirmationContext, confirmVariants)) {
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
                } else if (op === 'INSERT') {
                    // Two-stage gate for INSERTs (fuzzy match for duplicates)
                    const data = action.params?.data || {};
                    let titleCol = 'title';
                    if (data.title) titleCol = 'title';
                    else if (data.name) titleCol = 'name';
                    else if (data.front) titleCol = 'front';
                    
                    const titleToCheck = data[titleCol];
                    let possibleDuplicates: any[] = [];
                    
                    if (titleToCheck && typeof titleToCheck === 'string' && titleToCheck.length > 2) {
                        try {
                            // P0-2: use `ilike` (NOT `_ilike`) — applyFiltersToQuery only
                        // recognizes `$`-prefixed operators and the bare key `ilike`;
                        // an `_ilike` key degenerates into an equality against an
                        // object and silently returns zero rows, so possibleDuplicates
                        // could never populate.
                        const filters = {
                                [titleCol]: { ilike: `%${titleToCheck}%` }
                            };
                            const dupRes = await actionsService.executeDbAction(userId, table, 'SELECT', {}, filters, null, 3);
                            if (dupRes.success && Array.isArray(dupRes.data) && dupRes.data.length > 0) {
                                possibleDuplicates = dupRes.data.map((r:any) => ({ id: r.id, title: r.title || r.name || r.front }));
                            }
                        } catch (e) {
                            console.warn('[ActionExecution] Duplicate preflight check failed (non-fatal)', e);
                        }
                    }

                    const insertConfirmVariants = pendingSignatureVariants(table, 'INSERT', data, {}, []);
                    if (!confirmationMatchesPending(action.params, confirmationContext, insertConfirmVariants)) {
                        if (batchNeedsConfirmationReturned) {
                            // Already held a confirmation for this batch, automatically hold the rest.
                            // FIX (batch confirm): keep complete params for EVERY held action in the batch
                            // so that bare acceptance ("Yes, go ahead.") can execute the entire batch
                            // deterministically without dropping items or falling through to duplicate planner execution.
                            executedActions.push({
                                type: action.type,
                                success: false,
                                data: {
                                    needsConfirmation: true,
                                    heldInBatch: true,
                                    table,
                                    operation: op,
                                    proposedData: data,
                                    params: action.params
                                },
                                timestamp: new Date().toISOString()
                            });
                            continue;
                        }
                        batchNeedsConfirmationReturned = true;
                        executedActions.push({
                            type: action.type,
                            success: false,
                            data: {
                                needsConfirmation: true, 
                                possibleDuplicates, 
                                proposedData: data, 
                                // P0-3: deterministic origin — the user's own message wins.
                                requestOrigin: (confirmationContext?.userMessage ? deriveRequestOrigin(confirmationContext.userMessage) : '') || action.params?.requestOrigin || 'inferred',
                                batchSize: insertCountByTable[table] || 1,
                                table,
                                params: action.params 
                            },
                            timestamp: new Date().toISOString()
                        });
                        console.log(`[ActionExecution] ${action.type} requires confirmation before INSERT`, { table, batchSize: insertCountByTable[table] });
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
                // V1 write-detector needs the operation on the result — without it a
                // true "I've added X" after a real INSERT would be misread as a false
                // success claim (executedWrites would always be 0).
                operation: action.params?.operation,
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
