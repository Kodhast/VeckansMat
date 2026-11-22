// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces.
// Bindings such as the database come from `import { env } from 'cloudflare:workers'`;
// adapter-cloudflare does not fill in event.platform.
declare global {
	namespace App {
		interface Locals {
			/** Who is logged in, from the Access token (src/hooks.server.ts), or null. */
			email: string | null;
		}
	}

	namespace Cloudflare {
		interface Env {
			/** "true" only in the browser tests, so a recipe link may point at the test's own server. */
			ALLOW_LOCAL_FETCH?: string;
			/** A secret on each Worker, never in the repo. */
			ANTHROPIC_API_KEY: string;
			/** Secrets: the Access team's domain and the application's audience tag (#194). Without
			 * them the Worker lets nobody in. */
			ACCESS_TEAM_DOMAIN?: string;
			ACCESS_AUD?: string;
			/** "true" only in the browser tests, which have no Access in front. */
			SKIP_ACCESS?: string;
			/** Set only in the browser tests, to a stand-in for Claude's API. */
			CLAUDE_BASE_URL?: string;
			/** Set only in the browser tests, to made-up chain sites in place of the real ones. */
			OFFER_SITE_URL?: string;
		}
	}
}

export {};
