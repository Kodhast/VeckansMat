import { expect, test, type Page } from '@playwright/test';
import { countLoads, open, reload, saved, swipeAt, writeDay } from '../../../test/e2e';
import { shownWeek, swedishToday } from '../../lib/weeks';

// Has a Worker of its own in playwright.config.ts, since it writes the same weeks as the tests of
// Veckan. The made-up dishes come from test/e2e-seed.sql.
test.describe.configure({ mode: 'serial' });

test('the week shopping list is made from the dishes and ticked off in the store', async ({
	page
}) => {
	// A week with a dish that has ingredients, and one with just a name.
	await open(page, '/');
	await page.getByRole('button', { name: /^Middag måndag/ }).click();
	await page.getByRole('textbox', { name: 'Middag måndag' }).fill('Fiskgratäng');
	await page.keyboard.press('Enter');
	await page.getByRole('textbox', { name: 'Middag tisdag' }).fill('Pyttipanna i handlaprovet');
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('button', { name: 'Middag tisdag: Pyttipanna i handlaprovet' })
	).toBeVisible();

	await open(page, '/handla');
	await expect(page.getByText('1 rätt har bara namn')).toBeVisible();
	await page.getByRole('button', { name: 'Gör inköpslistan' }).click();

	// Claude's list, under the store's sections in their order, with what is likely at home last.
	await expect(page.getByRole('heading', { level: 2 })).toHaveText([
		/Frukt och grönt/,
		/Skafferi/,
		/Finns kanske hemma/
	]);
	const onion = page.getByRole('checkbox', { name: 'Gul lök' });
	await expect(onion).toBeVisible();
	// The dishes an item is for are behind its info button.
	await page
		.getByRole('button', { name: 'Till vilka rätter: Till pyttipanna i handlaprovet' })
		.click();
	await expect(page.getByText('Pyttipanna i handlaprovet · gissat')).toBeVisible();
	await page.keyboard.press('Escape');

	// Ticked off, it moves to the basket, which is folded, and stays there after a reload.
	await onion.click();
	const basket = page.getByRole('button', { name: /I korgen/ });
	await expect(basket).toBeVisible();
	await expect(onion).toBeHidden();
	await saved(page);
	await reload(page);
	await page.getByRole('button', { name: /I korgen/ }).click();
	await expect(page.getByRole('checkbox', { name: 'Gul lök' })).toBeChecked();

	// Nothing in the store loads the page again, so nothing on it jumps.
	const loads = countLoads(page);

	// Undo takes it out of the basket again.
	await page.getByRole('checkbox', { name: 'Salt' }).click();
	await page.locator('.kh-snackbar').getByRole('button', { name: 'Ångra' }).click();
	await expect(page.getByRole('checkbox', { name: 'Salt' })).not.toBeChecked();

	// Items written by hand, two in a row from the add button, stay when the list is made again.
	await page.getByRole('button', { name: 'Lägg till en vara', exact: true }).click();
	const field = page.getByRole('textbox', { name: 'Lägg till en vara' });
	await field.fill('Kaffe');
	await page.keyboard.press('Enter');
	await field.fill('Te');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('checkbox', { name: 'Kaffe' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Te' })).toBeVisible();
	await page.getByRole('button', { name: 'Stäng' }).click();
	await expect(field).toHaveCount(0);
	await saved(page);
	expect(loads()).toBe(0);
	await page.getByRole('button', { name: 'Gör om listan från veckan' }).click();
	await expect(page.getByRole('checkbox', { name: 'Kaffe' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: 'Gul lök' })).toBeChecked();
	// Without swiping, as with a mouse, an item written by hand is removed from its popup, last.
	await page.getByRole('button', { name: 'Mer om Te' }).click();
	await page.getByRole('button', { name: 'Ta bort Te' }).click();
	await expect(page.getByRole('checkbox', { name: 'Te' })).toHaveCount(0);
	await page.locator('.kh-snackbar').getByRole('button', { name: 'Ångra' }).click();
	await expect(page.getByRole('checkbox', { name: 'Te' })).toBeVisible();
});

test('an amount is changed by hand, and stays when the list is made again', async ({ page }) => {
	await open(page, '/handla');
	const loads = countLoads(page);
	const amount = page.getByRole('button', { name: 'Ändra mängd: Till fiskgratäng' });
	await expect(amount).toHaveText('1 st');

	// A tap on the amount opens the sheet and leaves the item unticked.
	await amount.click();
	const sheet = page.getByRole('dialog', { name: 'Till fiskgratäng' });
	await expect(sheet.getByText('Claude räknade 1 st')).toBeVisible();
	await expect(sheet.getByRole('button', { name: 'Mindre' })).toBeDisabled();
	await sheet.getByRole('button', { name: 'Mer' }).click();
	await expect(sheet.getByRole('textbox', { name: 'Mängd' })).toHaveValue('2 st');
	await sheet.getByRole('button', { name: 'Spara' }).click();
	await expect(sheet).toBeHidden();
	await expect(amount).toHaveText('2 st');
	await expect(amount).toHaveClass(/edited/);
	await expect(page.getByRole('checkbox', { name: 'Till fiskgratäng' })).not.toBeChecked();

	// An item without an amount gets one written in.
	await page.getByRole('button', { name: 'Ändra mängd: Salt' }).click();
	await page.getByRole('textbox', { name: 'Mängd' }).fill('1 paket');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Ändra mängd: Salt' })).toHaveText('1 paket');
	await saved(page);
	expect(loads()).toBe(0);

	// The popup says what Claude worked out.
	await page.getByRole('button', { name: 'Till vilka rätter: Till fiskgratäng' }).click();
	await expect(page.getByText('Ändrad för hand. Claude räknade 1 st.')).toBeVisible();
	await page.keyboard.press('Escape');

	// Made again, the changed items stay as they are, and Claude's are not added beside them.
	await page.getByRole('button', { name: 'Gör om listan från veckan' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Claude gör listan' })).toBeHidden();
	await expect(amount).toHaveText('2 st');
	await expect(page.getByRole('checkbox', { name: 'Till fiskgratäng' })).toHaveCount(1);
	await expect(page.getByRole('checkbox', { name: 'Salt' })).toHaveCount(1);

	// And back to what Claude worked out.
	await amount.click();
	await sheet.getByRole('button', { name: 'Som Claude räknade' }).click();
	await expect(amount).toHaveText('1 st');
	await saved(page);
	await reload(page);
	await expect(page.getByRole('button', { name: 'Ändra mängd: Till fiskgratäng' })).toHaveText(
		'1 st'
	);
	await expect(page.getByRole('button', { name: 'Ändra mängd: Salt' })).toHaveText('1 paket');
});

/**
 * Swipes the row of an item to the left with a finger, over `share` of its width; `pause` between
 * the moves makes it slow, since a quick flick takes the row away however short it is.
 */
async function swipe(page: Page, text: string, share: number, pause = 0) {
	const row = page.locator('li', { has: page.getByRole('checkbox', { name: text }) });
	const box = (await row.boundingBox())!;
	await swipeAt(page, box.x + box.width - 90, box.y + box.height / 2, -box.width * share, 0, pause);
}

test('any item is swiped away, and undo puts it back with its dishes', async ({ page }) => {
	await open(page, '/handla');
	const item = page.getByRole('checkbox', { name: 'Till fiskgratäng' });
	await expect(item).toBeVisible();

	// A short, slow swipe leaves it, and does not tick it either.
	await swipe(page, 'Till fiskgratäng', 0.25, 40);
	await expect(item).toBeVisible();
	await expect(item).not.toBeChecked();
	// And the next tap still ticks it.
	await item.click();
	await expect(item).toBeHidden();
	await page.locator('.kh-snackbar').getByRole('button', { name: 'Ångra' }).click();
	await expect(item).toBeVisible();

	// A long one takes it away, and stays on Handla rather than going to the next view (#105).
	await swipe(page, 'Till fiskgratäng', 0.7);
	await expect(item).toHaveCount(0);
	await expect(page).toHaveURL(/\/handla$/);
	await page.locator('.kh-snackbar').getByRole('button', { name: 'Ångra' }).click();
	await expect(item).toBeVisible();
	await saved(page);
	await reload(page);
	await page.getByRole('button', { name: 'Till vilka rätter: Till fiskgratäng' }).click();
	await expect(page.getByText('Fiskgratäng', { exact: true })).toBeVisible();

	// From the popup too.
	await page.getByRole('button', { name: 'Ta bort Till fiskgratäng' }).click();
	await expect(item).toHaveCount(0);
	await saved(page);
	await reload(page);
	await expect(page.getByRole('checkbox', { name: 'Till fiskgratäng' })).toHaveCount(0);

	// To the right a row is the page's, and goes back to Veckan (#105).
	const row = (await page.locator('kh-swipe').first().boundingBox())!;
	// From the text, as a finger on the check ticks it rather than swiping.
	await swipeAt(page, row.x + 100, row.y + row.height / 2, 200);
	await expect(page).toHaveURL(/\/$/);
});

test('a folded section stays folded on the phone', async ({ page }) => {
	await open(page, '/handla');
	const section = page.getByRole('button', { name: /Skafferi/ });
	await expect(section).toHaveAttribute('aria-expanded', 'true');
	await section.click();
	await expect(section).toHaveAttribute('aria-expanded', 'false');
	await reload(page);
	await expect(page.getByRole('button', { name: /Skafferi/ })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await page.getByRole('button', { name: /Skafferi/ }).click();
});

test('the guessed ingredients are written into the dish', async ({ page }) => {
	await open(page, '/ratter');
	await page.getByRole('link', { name: /Pyttipanna i handlaprovet/ }).click();
	await expect(page.getByText('Claude har gissat ingredienserna till inköpslistan.')).toBeVisible();
	await expect(page.getByText('500 g potatis')).toBeVisible();
});

test('a list made before the week changed offers to be updated', async ({ page }) => {
	await open(page, '/');
	await writeDay(page, 'onsdag', 'Linsgryta i handlaprovet');

	await open(page, '/handla');
	const changed = page.getByRole('heading', { name: 'Veckan har ändrats' });
	await expect(changed).toBeVisible();
	await page.getByRole('button', { name: 'Inte nu' }).click();
	await expect(changed).toHaveCount(0);

	await saved(page);
	await reload(page);
	await page.getByRole('button', { name: 'Uppdatera listan' }).click();
	await expect(changed).toHaveCount(0);
	await expect(page.getByRole('checkbox', { name: 'Till linsgryta i handlaprovet' })).toBeVisible();
});

test('a list being made for one week leaves the other week alone', async ({ page }) => {
	await open(page, '/handla');
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/handla?/make', async (route) => {
		await held;
		await route.continue();
	});
	await page.getByRole('button', { name: 'Gör om listan från veckan' }).click();
	const status = page.getByRole('status').filter({ hasText: 'Claude gör listan' });
	await expect(status).toBeVisible();

	// To whichever week is not shown.
	await page.locator('.week-nav a.kh-icon-btn').click();
	await expect(page).toHaveURL(/vecka=/);
	await expect(status).toBeHidden();
	release();
});

test('an amount changed by hand asks when a new dish needs the item too', async ({ page }) => {
	// The week the app does not open on, which no other test makes a list for.
	const shown = shownWeek(null, swedishToday());
	const week = shown.weekStart === shown.thisWeek ? shown.nextWeek : shown.thisWeek;
	await open(page, `/?vecka=${week}`);
	await writeDay(page, 'måndag', 'Purjolökssoppa');
	await page.keyboard.press('Escape');

	await open(page, `/handla?vecka=${week}`);
	await page.getByRole('button', { name: 'Gör inköpslistan' }).click();
	const amount = page.getByRole('button', { name: 'Ändra mängd: Purjolök' });
	await expect(amount).toHaveText('1 st');
	await amount.click();
	const sheet = page.getByRole('dialog', { name: 'Purjolök' });
	await sheet.getByRole('textbox', { name: 'Mängd' }).fill('3 st');
	await sheet.getByRole('button', { name: 'Spara' }).click();
	await expect(amount).toHaveText('3 st');

	// A fish gratin on Tuesday needs leeks too, and the list is made again.
	await open(page, `/?vecka=${week}`);
	await writeDay(page, 'tisdag', 'Fiskgratäng');
	await page.keyboard.press('Escape');
	await open(page, `/handla?vecka=${week}`);
	await page.getByRole('button', { name: 'Gör om listan från veckan' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Claude gör listan' })).toBeHidden();

	// One leek item, the household's amount, and the question.
	await expect(page.getByRole('checkbox', { name: 'Purjolök', exact: true })).toHaveCount(1);
	await expect(amount).toHaveText('3 st');
	await expect(page.getByText('Ny rätt · Claude räknar 2 st')).toBeVisible();
	const notice = page.getByText('1 vara du ändrat har fått ändrade rätter');
	await expect(notice).toBeVisible();

	// The notice is closed for the week, also when the page is loaded again.
	await page.getByRole('button', { name: 'Stäng' }).click();
	await expect(notice).toBeHidden();
	await reload(page);
	await expect(page.getByText('Ny rätt · Claude räknar 2 st')).toBeVisible();
	await expect(notice).toBeHidden();

	// Taking Claude's asks no more.
	await amount.click();
	await expect(sheet.getByText('En ny rätt behöver den här varan')).toBeVisible();
	await sheet.getByRole('button', { name: 'Ta Claudes 2 st' }).click();
	await expect(amount).toHaveText('2 st');
	await expect(page.getByText('Ny rätt · Claude räknar 2 st')).toBeHidden();
	await saved(page);
	await reload(page);
	await expect(amount).toHaveText('2 st');
	await expect(page.getByText(/Claude räknar/)).toHaveCount(0);
});
