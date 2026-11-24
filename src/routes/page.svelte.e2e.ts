import { expect, test } from '@playwright/test';
import { assertSinglePrimaryAction } from '@kodhast/web-ui/prov.js';
import { fromAccountMenu, open } from '../../test/e2e';
import pkg from '../../package.json' with { type: 'json' };

// D-3: högst en primär handling (fylld knapp eller huvudknappen) synlig när varje prov är klart.
test.afterEach(async ({ page }) => assertSinglePrimaryAction(page));

test('start page shows the week', async ({ page }) => {
	await page.goto('/');
	// The week is the header's title, and which week it is the line under it.
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Vecka \d+$/);
	await expect(page.locator('.kh-header__subtitle')).toHaveText(/^(Den här veckan|Nästa vecka)$/);
	await expect(page.getByRole('heading', { level: 2, name: 'Veckans meny' })).toBeVisible();
});

test('web-ui elements are registered in the browser', async ({ page }) => {
	await open(page, '/');
	expect(await page.evaluate(() => customElements.get('kh-toolbar') !== undefined)).toBe(true);
});

test('health endpoint answers', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ status: 'ok', version: pkg.version, database: 'ok' });
});

test('the header shows the version after the name', async ({ page }) => {
	await open(page, '/');
	await expect(page.locator('.kh-header__name')).toHaveText('Veckans mat');
	await expect(page.locator('.kh-header__version')).toHaveText(pkg.version);
	await expect(page.locator('.kh-header__version')).toBeVisible();
});

test('Om appen has the version and signs the app as a Kodhäst app', async ({ page }) => {
	await open(page, '/');
	await fromAccountMenu(page, 'Om appen');
	await expect(page).toHaveURL('/om');
	const main = page.getByRole('main');
	await expect(main).toContainText(`Version ${pkg.version}`);
	await expect(main).toContainText('En kodhäst-app');
	// The mark is decoration; the line reads as its text alone.
	await expect(main.locator('.signature svg')).toHaveAttribute('aria-hidden', 'true');
	await page.getByRole('link', { name: 'Tillbaka' }).click();
	await expect(page).toHaveURL('/');
});

test('the toolbar has no plus button where the view has no main action', async ({ page }) => {
	await open(page, '/veckor');
	await expect(page.locator('.kh-toolbar__action')).toHaveCount(0);
	await open(page, '/handla');
	await expect(page.locator('.kh-toolbar__action')).toHaveCount(1);
});

test('section headings have the two dots and keep their names', async ({ page }) => {
	await open(page, '/installningar');
	const heading = page.getByRole('heading', { level: 2, name: 'Personer', exact: true });
	await expect(heading).toBeVisible();
	const dots = await heading.evaluate((el) => getComputedStyle(el, '::before').boxShadow);
	expect(dots).not.toBe('none');
});

test('a folding card heading has no dots', async ({ page }) => {
	await open(page, '/ratter');
	const heading = page.locator('.kh-card h2').first();
	await expect(heading).toBeVisible();
	const dots = await heading.evaluate((el) => getComputedStyle(el, '::before').content);
	expect(dots).toBe('none');
});

test('a new version offers a reload that loads it', async ({ page }) => {
	await open(page, '/');
	await page.route('**/_app/version.json', (route) =>
		route.fulfill({ json: { version: '99.0.0' } })
	);

	// SvelteKit checks for a new version when the window gains focus.
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByText('Ny version finns')).toBeVisible();

	const reload = page.waitForEvent('load');
	await page.getByRole('button', { name: 'Ladda om' }).click();
	await reload;
});

test('the app loads again when it comes back on another day', async ({ page }) => {
	await page.clock.install({ time: Date.now() - 24 * 60 * 60 * 1000 });
	await open(page, '/');
	let loads = 0;
	page.on('request', (request) => {
		if (request.url().includes('__data.json')) loads++;
	});

	// The same day: nothing to load.
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await page.waitForTimeout(300);
	expect(loads).toBe(0);

	// The next day.
	await page.clock.setSystemTime(Date.now());
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect.poll(() => loads).toBe(1);
});

test("a new version steps aside while web-ui's snackbar shows", async ({ page }) => {
	await open(page, '/');
	await page.route('**/_app/version.json', (route) =>
		route.fulfill({ json: { version: '99.0.0' } })
	);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	const notice = page.getByText('Ny version finns');
	await expect(notice).toBeVisible();

	// As the undo after a dish is swapped on Veckan.
	await page.evaluate(() =>
		document.body.insertAdjacentHTML(
			'beforeend',
			'<div id="undo" class="kh-snackbar-host"><div class="kh-snackbar">Ångra</div></div>'
		)
	);
	await expect(notice).toBeHidden();
	await page.evaluate(() => document.getElementById('undo')?.remove());
	await expect(notice).toBeVisible();
});
