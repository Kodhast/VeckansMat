import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { verifyAccessToken } from '#lib/server/access.ts';

/**
 * Every request but the health check needs a valid Access token, so that a path Access does not
 * cover is closed too (#194). The email the app uses comes from the token. In `vite dev` and the
 * browser tests, which have no Access in front, the email header stands in for it.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/api/health') {
		event.locals.email = null;
		return resolve(event);
	}
	if (dev || env.SKIP_ACCESS === 'true') {
		event.locals.email = event.request.headers.get('cf-access-authenticated-user-email');
		return resolve(event);
	}
	const identity = await verifyAccessToken(event.request.headers.get('cf-access-jwt-assertion'), {
		teamDomain: env.ACCESS_TEAM_DOMAIN,
		aud: env.ACCESS_AUD
	});
	if (!identity) return new Response('Forbidden', { status: 403 });
	event.locals.email = identity.email;
	return resolve(event);
};
