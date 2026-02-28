// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Wrap fetch to ensure Accept header for REST calls and optionally log failures.
// We enable the wrapper in all environments so PostgREST doesn't return 406
// due to strict Accept negotiation. Detailed logging remains gated to DEV.
let clientOptions: any = {};
if (typeof window !== 'undefined' && window.fetch) {
	const originalFetch = window.fetch.bind(window);
	const wrappedFetch = async (input: RequestInfo, init?: RequestInit) => {
		try {
			const url = typeof input === 'string' ? input : (input as Request).url;
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

