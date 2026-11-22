/**
 * Checks the token Cloudflare Access puts on every request it lets through (#194), so that the app
 * does not rely on Access covering every path: a request without a valid token is refused, also
 * where Access has a gap. See docs/beslut/0028-access-token-i-appen.md.
 */

/** What a valid token says: the account's email, or null for a service token. */
export interface AccessIdentity {
	email: string | null;
}

interface Settings {
	/** The team's domain, such as team.cloudflareaccess.com, without https://. */
	teamDomain: string | undefined;
	/** The Access application's audience tag. */
	aud: string | undefined;
	now?: Date;
	fetch?: typeof fetch;
}

type Key = JsonWebKey & { kid?: string };

/** How long the team's public keys are kept before they are fetched again. Access rotates them
 * every six weeks and publishes the next one in advance, so an hour is short enough. */
const KEYS_TTL_MS = 60 * 60 * 1000;
/** Clocks differ a little between Access and the Worker. */
const LEEWAY_S = 60;

let cached: { domain: string; keys: Key[]; at: number } | null = null;

/** Forgets the fetched keys; for the tests. */
export function forgetAccessKeys() {
	cached = null;
}

async function keys(domain: string, now: number, fetcher: typeof fetch, fresh: boolean) {
	if (!fresh && cached?.domain === domain && now - cached.at < KEYS_TTL_MS) return cached.keys;
	const response = await fetcher(`https://${domain}/cdn-cgi/access/certs`);
	if (!response.ok) throw new Error(`Access certs answered ${response.status}`);
	const body = (await response.json()) as { keys?: Key[] };
	cached = { domain, keys: body.keys ?? [], at: now };
	return cached.keys;
}

function base64url(text: string): Uint8Array<ArrayBuffer> {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function part(text: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(new TextDecoder().decode(base64url(text)));
		return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/**
 * The identity in an Access token, or null when the token is missing, not signed by the team's
 * key, for another application, from another team or out of date. Without the settings nothing
 * is valid, so a Worker without its secrets lets nobody in.
 */
export async function verifyAccessToken(
	token: string | null,
	{ teamDomain, aud, now = new Date(), fetch: fetcher = fetch }: Settings
): Promise<AccessIdentity | null> {
	// Written with or without https:// and a slash at the end, the domain is the same.
	const domain = teamDomain
		?.trim()
		.replace(/^https:\/\//, '')
		.replace(/\/+$/, '');
	if (!token || !domain || !aud?.trim()) return null;
	const [head, body, signature, ...rest] = token.split('.');
	if (!head || !body || !signature || rest.length > 0) return null;
	const header = part(head);
	const claims = part(body);
	if (!header || !claims || header.alg !== 'RS256') return null;

	const seconds = now.getTime() / 1000;
	const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	if (!audiences.includes(aud.trim())) return null;
	if (claims.iss !== `https://${domain}`) return null;
	if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_S < seconds) return null;
	if (typeof claims.nbf === 'number' && claims.nbf - LEEWAY_S > seconds) return null;

	// A key the cache does not know may be a new one, so the keys are fetched again once.
	let key: Key | undefined;
	try {
		key = (await keys(domain, now.getTime(), fetcher, false)).find((k) => k.kid === header.kid);
		key ??= (await keys(domain, now.getTime(), fetcher, true)).find((k) => k.kid === header.kid);
	} catch (error) {
		console.error('The Access keys could not be fetched', error);
		return null;
	}
	if (!key) return null;

	const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
	const verified = await crypto.subtle
		.importKey('jwk', { kty: key.kty, n: key.n, e: key.e }, algorithm, false, ['verify'])
		.then((publicKey) =>
			crypto.subtle.verify(
				algorithm,
				publicKey,
				base64url(signature),
				new TextEncoder().encode(`${head}.${body}`)
			)
		)
		.catch(() => false);
	if (!verified) return null;
	return { email: typeof claims.email === 'string' && claims.email ? claims.email : null };
}
