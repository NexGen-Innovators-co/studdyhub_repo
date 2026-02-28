// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Wrap fetch to ensure Accept header for REST calls and optionally log failures.
// We enable the wrapper in all environments so PostgREST doesn't return 406
// due to strict Accept negotiation. Detailed logging remains gated to DEV.
let clientOptions: any = {};

// Simple cooldown to prevent tight refresh_token retry storms when the
// token endpoint returns 429. This prevents many repeated refresh attempts
// from overwhelming the auth endpoint and causing immediate sign-out loops.
let refreshCooldownUntil = 0;
if (typeof window !== 'undefined' && window.fetch) {
	const originalFetch = window.fetch.bind(window);
	const wrappedFetch = async (input: RequestInfo, init?: RequestInit) => {
		try {
			const url = typeof input === 'string' ? input : (input as Request).url;

			// Throttle token refresh attempts: if a cooldown is active and this
			// request is a refresh_token grant, return an early 429-like response.
			if (url && url.includes('/token') && url.includes('grant_type=refresh_token')) {
				if (Date.now() < refreshCooldownUntil) {
					return new Response(JSON.stringify({ error: 'rate_limited_refresh' }), { status: 429, statusText: 'Too Many Requests', headers: { 'Content-Type': 'application/json' } });
				}
			}

			// If this is a token refresh request, perform it and set a cooldown
			// if the auth endpoint returns a 429 to avoid immediate retry storms.
			if (url && url.includes('/token') && url.includes('grant_type=refresh_token')) {
				const resp = await originalFetch(input, init);
				if (resp.status === 429) {
					// 5 second cooldown (adjustable)
					refreshCooldownUntil = Date.now() + 5000;
				}
				return resp;
			}

			// Only inspect REST v1 calls
			if (url && url.includes('/rest/v1/')) {
				const headers = new Headers(init?.headers as HeadersInit || {});
				// Use a permissive Accept to avoid 406 Not Acceptable responses from PostgREST
				if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/plain, */*');
				// ensure we pass through headers
				const newInit = { ...(init || {}), headers } as RequestInit;
				// console.debug('[supabase:fetch]', url, newInit);
				const resp = await originalFetch(input, newInit);
				if (!resp.ok) {
					try {
						const text = await resp.clone().text();
						// Log full body to aid debugging 406/Not Acceptable responses (only in dev)
						if (import.meta.env.DEV) {
							console.warn('[supabase:fetch] non-OK response', { status: resp.status, statusText: resp.statusText, body: text, url });
						}
					} catch (e) {
						// console.warn('[supabase:fetch] non-OK response', resp.status, resp.statusText, url);
					}
				}
				return resp;
			}
		} catch (e) {
			// fall through to default fetch
		}
		return originalFetch(input, init);
	};

	clientOptions = { global: { fetch: wrappedFetch } };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)

