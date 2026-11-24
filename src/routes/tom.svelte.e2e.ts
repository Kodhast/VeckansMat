import { expect, test } from '@playwright/test';
import { assertSinglePrimaryAction } from '@kodhast/web-ui/prov.js';
import { open } from '../../test/e2e';

// D-3: högst en primär handling (fylld knapp eller huvudknappen) synlig när varje prov är klart.
test.afterEach(async ({ page }) => assertSinglePrimaryAction(page));

// A Worker of its own with no dishes and no weeks, so the lists show what they say when empty.

test('the dishes say there are none yet, under the mark', async ({ page }) => {
	await open(page, '/ratter');
	const empty = page.locator('.empty');
	await expect(empty).toHaveText('Inga rätter än. Skriv namnet på en rätt ovan och lägg till den.');
	await expect(empty.locator('svg')).toHaveAttribute('aria-hidden', 'true');
});

test('the weeks say there are none yet, under the mark', async ({ page }) => {
	await open(page, '/veckor');
	const empty = page.locator('.empty');
	await expect(empty).toHaveText('Inga veckor än. När ni har planerat en vecka hamnar den här.');
	await expect(empty.locator('svg')).toHaveAttribute('aria-hidden', 'true');
});
