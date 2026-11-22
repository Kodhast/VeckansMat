import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as access from '#lib/server/access.ts';
import { handle } from './hooks.server';

// Vitest runs as `vite dev`, where the check is off; here it runs as in the Worker.
vi.mock('$app/env', () => ({ dev: false }));

type Input = Parameters<typeof handle>[0];

// The token check itself is tested in src/lib/server/access.spec.ts.
function request(path: string, headers: Record<string, string> = {}) {
	const event = {
		url: new URL(`https://exempel.se${path}`),
		request: new Request(`https://exempel.se${path}`, { headers }),
		locals: {} as App.Locals
	} as Input['event'];
	const resolve = vi.fn(async () => new Response('ok'));
	return { event, resolve, run: () => handle({ event, resolve } as unknown as Input) };
}

afterEach(() => {
	vi.restoreAllMocks();
	delete env.SKIP_ACCESS;
	delete env.ACCESS_TEAM_DOMAIN;
	delete env.ACCESS_AUD;
});

describe('handle', () => {
	it('refuses a request without a valid token, also with the email header', async () => {
		const { resolve, run } = request('/', { 'cf-access-authenticated-user-email': 'a@exempel.se' });
		const response = await run();
		expect(response.status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('takes the email from a valid token', async () => {
		env.ACCESS_TEAM_DOMAIN = 'exempel.cloudflareaccess.com';
		env.ACCESS_AUD = 'aud-exempel';
		const verify = vi
			.spyOn(access, 'verifyAccessToken')
			.mockResolvedValue({ email: 'alex@exempel.se' });
		const { event, resolve, run } = request('/handla', {
			'cf-access-jwt-assertion': 'token',
			'cf-access-authenticated-user-email': 'sam@exempel.se'
		});
		expect((await run()).status).toBe(200);
		expect(verify).toHaveBeenCalledWith('token', {
			teamDomain: 'exempel.cloudflareaccess.com',
			aud: 'aud-exempel'
		});
		expect(event.locals.email).toBe('alex@exempel.se');
		expect(resolve).toHaveBeenCalled();
	});

	it('lets the health check through without a token', async () => {
		const { resolve, run } = request('/api/health');
		expect((await run()).status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});

	it('reads the email header in the browser tests, which have no Access in front', async () => {
		env.SKIP_ACCESS = 'true';
		const { event, run } = request('/', { 'cf-access-authenticated-user-email': 'a@exempel.se' });
		expect((await run()).status).toBe(200);
		expect(event.locals.email).toBe('a@exempel.se');
	});
});
