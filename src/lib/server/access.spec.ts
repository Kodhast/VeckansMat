import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { forgetAccessKeys, verifyAccessToken } from './access';

// A made-up team and a key made in the test; nothing here is the household's.
const TEAM = 'exempel.cloudflareaccess.com';
const AUD = 'aud-exempel';
const NOW = new Date('2026-11-22T12:00:00Z');
const seconds = NOW.getTime() / 1000;

const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
let pair: CryptoKeyPair;
let other: CryptoKeyPair;
let jwk: JsonWebKey;

const generate = () =>
	crypto.subtle.generateKey(
		{ ...algorithm, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
		true,
		['sign', 'verify']
	) as Promise<CryptoKeyPair>;

beforeAll(async () => {
	pair = await generate();
	other = await generate();
	jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});

afterEach(() => {
	forgetAccessKeys();
	vi.restoreAllMocks();
});

const encode = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const json = (value: object) => encode(new TextEncoder().encode(JSON.stringify(value)));

async function token(claims: object = {}, key = pair.privateKey, kid = 'nyckel-1') {
	const head = json({ alg: 'RS256', kid, typ: 'JWT' });
	const body = json({
		aud: [AUD],
		iss: `https://${TEAM}`,
		email: 'alex@exempel.se',
		exp: seconds + 3600,
		iat: seconds - 60,
		nbf: seconds - 60,
		...claims
	});
	const signature = await crypto.subtle.sign(
		algorithm,
		key,
		new TextEncoder().encode(`${head}.${body}`)
	);
	return `${head}.${body}.${encode(new Uint8Array(signature))}`;
}

/** The team's certs endpoint, which counts how often it is asked. */
function certs(kid = 'nyckel-1') {
	const fetcher = vi.fn(async (url: string | URL | Request) => {
		expect(String(url)).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
		return Response.json({ keys: [{ ...jwk, kid }] });
	});
	return fetcher as unknown as typeof fetch & typeof fetcher;
}

const settings = (fetcher: typeof fetch) => ({
	teamDomain: TEAM,
	aud: AUD,
	now: NOW,
	fetch: fetcher
});

describe('verifyAccessToken', () => {
	it('gives the email in a valid token, and keeps the keys between requests', async () => {
		const fetcher = certs();
		expect(await verifyAccessToken(await token(), settings(fetcher))).toEqual({
			email: 'alex@exempel.se'
		});
		expect(await verifyAccessToken(await token(), settings(fetcher))).not.toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('takes the domain with https:// and a slash too', async () => {
		const loose = { ...settings(certs()), teamDomain: ` https://${TEAM}/ `, aud: ` ${AUD} ` };
		expect(await verifyAccessToken(await token(), loose)).not.toBeNull();
	});

	it('lets a service token in without an email', async () => {
		const valid = await token({ email: undefined, common_name: 'tjanst.access' });
		expect(await verifyAccessToken(valid, settings(certs()))).toEqual({ email: null });
	});

	it('refuses a missing or malformed token', async () => {
		expect(await verifyAccessToken(null, settings(certs()))).toBeNull();
		expect(await verifyAccessToken('', settings(certs()))).toBeNull();
		expect(await verifyAccessToken('inte.en.token', settings(certs()))).toBeNull();
		expect(await verifyAccessToken('a.b', settings(certs()))).toBeNull();
	});

	it('refuses a token for another application or another team', async () => {
		expect(await verifyAccessToken(await token({ aud: ['annan'] }), settings(certs()))).toBeNull();
		const otherTeam = await token({ iss: 'https://annat.cloudflareaccess.com' });
		expect(await verifyAccessToken(otherTeam, settings(certs()))).toBeNull();
	});

	it('refuses a token out of date, but allows a minute between the clocks', async () => {
		const expired = await token({ exp: seconds - 120 });
		expect(await verifyAccessToken(expired, settings(certs()))).toBeNull();
		const early = await token({ nbf: seconds + 120 });
		expect(await verifyAccessToken(early, settings(certs()))).toBeNull();
		const justNow = await token({ exp: seconds - 30 });
		expect(await verifyAccessToken(justNow, settings(certs()))).not.toBeNull();
	});

	it('refuses a token signed with another key', async () => {
		const forged = await token({}, other.privateKey);
		expect(await verifyAccessToken(forged, settings(certs()))).toBeNull();
	});

	it('refuses a changed token', async () => {
		const [head, , signature] = (await token()).split('.');
		const changed = `${head}.${json({ aud: [AUD], iss: `https://${TEAM}`, email: 'sam@exempel.se', exp: seconds + 3600 })}.${signature}`;
		expect(await verifyAccessToken(changed, settings(certs()))).toBeNull();
	});

	it('fetches the keys again once for a key it does not know', async () => {
		const fetcher = certs('nyckel-1');
		expect(await verifyAccessToken(await token(), settings(fetcher))).not.toBeNull();
		const unknown = await token({}, pair.privateKey, 'nyckel-2');
		expect(await verifyAccessToken(unknown, settings(fetcher))).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('lets nobody in without the settings or when the keys cannot be fetched', async () => {
		const valid = await token();
		expect(await verifyAccessToken(valid, { ...settings(certs()), aud: undefined })).toBeNull();
		expect(
			await verifyAccessToken(valid, { ...settings(certs()), teamDomain: undefined })
		).toBeNull();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const down = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
		expect(await verifyAccessToken(valid, settings(down))).toBeNull();
	});
});
