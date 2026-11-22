import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../test/d1';
import { dinner, giveIngredients, WEEK } from '../../../../test/fixtures';
import { createPerson } from './household';
import { getWeek, setWeekRow } from './menus';
import { recipeLines } from '../shopping-make';
import { findRecipeByName } from './recipes';
import {
	addShoppingItem,
	deleteShoppingItem,
	getShoppingBasis,
	getShoppingList,
	keepShoppingItemAmount,
	resetShoppingItemAmount,
	restoreShoppingItem,
	saveShoppingList,
	setShoppingItemAmount,
	setShoppingItemChecked,
	takeSuggestedAmount,
	weekDishes,
	type Line
} from './shopping';

let db: D1Database;
useTestDb((test) => (db = test));

/** A made-up week: two dishes with ingredients, one with just a name, and leftovers. */
async function planWeek() {
	await setWeekRow(db, WEEK, dinner(2, 'Linsgryta'), []);
	await setWeekRow(db, WEEK, dinner(1, 'Fiskgratäng'), []);
	await setWeekRow(db, WEEK, dinner(3, 'Rester'), []);
	await setWeekRow(db, WEEK, dinner(4, 'Linsgryta'), []);
	await setWeekRow(db, WEEK, { weekday: 6, meal: 'lunch', text: 'Pannkakor' }, []);
	await giveIngredients(db, 'Fiskgratäng', ['400 g torsk', '2 dl grädde']);
	await giveIngredients(db, 'Linsgryta', ['3 dl röda linser', '1 gul lök']);
}

/** The list as it is made when Claude cannot: the recipes' lines, dish by dish. */
const makeFromRecipes = async (basis = 'basis') =>
	saveShoppingList(db, WEEK, {
		origin: 'recipe',
		items: recipeLines(await weekDishes(db, WEEK)),
		basis
	});

/** The id of a dish on the week, and one of its lines. */
const line = async (dish: string, position: number) => ({
	recipeId: (await findRecipeByName(db, dish))!.id,
	position
});

const tick = async (text: string) => {
	const item = (await getShoppingList(db, WEEK)).find((i) => i.text === text)!;
	await setShoppingItemChecked(db, item.id, true);
};

const shown = (items: Awaited<ReturnType<typeof getShoppingList>>) =>
	items.map(({ text, section, origin, checked }) => ({ text, section, origin, checked }));

describe('the week shopping list', () => {
	it('has the week dishes once each, in the order they are eaten', async () => {
		await planWeek();
		expect(await weekDishes(db, WEEK)).toEqual([
			expect.objectContaining({ name: 'Fiskgratäng', times: 1, lunchbox: false }),
			expect.objectContaining({
				name: 'Linsgryta',
				times: 2,
				ingredients: ['3 dl röda linser', '1 gul lök']
			}),
			expect.objectContaining({ name: 'Pannkakor', times: 1, ingredients: [] })
		]);
	});

	it('is empty until it is made, and then lists each dish lines under the dish', async () => {
		await planWeek();
		expect(await getShoppingList(db, WEEK)).toEqual([]);

		await makeFromRecipes();
		const recipe = { origin: 'recipe', checked: false };
		expect(shown(await getShoppingList(db, WEEK))).toEqual([
			{ text: '400 g torsk', section: 'Fiskgratäng', ...recipe },
			{ text: '2 dl grädde', section: 'Fiskgratäng', ...recipe },
			{ text: '3 dl röda linser', section: 'Linsgryta', ...recipe },
			{ text: '1 gul lök', section: 'Linsgryta', ...recipe }
		]);
	});

	it('is made again with what is written by hand and what is in the basket kept', async () => {
		await planWeek();
		await makeFromRecipes();
		await addShoppingItem(db, WEEK, '  Mjölk ');
		const [cod] = await getShoppingList(db, WEEK);
		await setShoppingItemChecked(db, cod.id, true);

		// The lentil stew is swapped for one without ingredients.
		await setWeekRow(db, WEEK, dinner(2, 'Tacos'), []);
		await setWeekRow(db, WEEK, dinner(4, 'Tacos'), []);
		await makeFromRecipes();

		expect(shown(await getShoppingList(db, WEEK))).toEqual([
			{ text: '400 g torsk', section: 'Fiskgratäng', origin: 'recipe', checked: true },
			{ text: 'Mjölk', section: null, origin: 'hand', checked: false },
			{ text: '2 dl grädde', section: 'Fiskgratäng', origin: 'recipe', checked: false }
		]);
	});

	it('notes what it was made from', async () => {
		expect(await getShoppingBasis(db, WEEK)).toBeNull();
		await planWeek();
		await makeFromRecipes('first');
		expect(await getShoppingBasis(db, WEEK)).toBe('first');
	});

	it('saves Claude list with the basket kept and the guesses in their dishes', async () => {
		await planWeek();
		await makeFromRecipes();
		await tick('400 g torsk');
		await addShoppingItem(db, WEEK, 'Kaffe');
		const pancakes = (await findRecipeByName(db, 'Pannkakor'))!;
		const stew = (await findRecipeByName(db, 'Linsgryta'))!;

		await saveShoppingList(db, WEEK, {
			origin: 'claude',
			items: [
				{ text: 'Mjöl', amount: null, section: 'Finns kanske hemma', lines: [] },
				// The cod in the basket, under another name.
				{
					text: 'Torskfilé',
					amount: '400 g',
					section: 'Kött och fisk',
					lines: [await line('Fiskgratäng', 0)]
				},
				{
					text: 'Ägg',
					amount: '3 st',
					section: 'Mejeri och ägg',
					lines: [await line('Pannkakor', 0)]
				}
			],
			guesses: [
				{ recipeId: pancakes.id, ingredients: ['3 ägg', '6 dl mjölk'] },
				// A dish with ingredients keeps them.
				{ recipeId: stew.id, ingredients: ['Fel'] }
			],
			basis: 'claude'
		});

		const list = await getShoppingList(db, WEEK);
		expect(shown(list)).toEqual([
			{ text: '400 g torsk', section: 'Fiskgratäng', origin: 'recipe', checked: true },
			{ text: 'Kaffe', section: null, origin: 'hand', checked: false },
			{ text: 'Mjöl', section: 'Finns kanske hemma', origin: 'claude', checked: false },
			{ text: 'Ägg', section: 'Mejeri och ägg', origin: 'claude', checked: false }
		]);
		expect(list.find((i) => i.text === 'Ägg')!.dishes).toEqual([
			{ name: 'Pannkakor', guessed: true }
		]);
		expect(list.find((i) => i.text === 'Mjöl')!.dishes).toEqual([]);
		expect(await getShoppingBasis(db, WEEK)).toBe('claude');
		const dishes = await weekDishes(db, WEEK);
		expect(dishes.find((d) => d.name === 'Pannkakor')).toMatchObject({
			servings: null,
			ingredients: ['3 ägg', '6 dl mjölk'],
			ingredientsGuessed: true
		});
		// A guessed dish can still be filled in from a recipe.
		expect(await findRecipeByName(db, 'Pannkakor')).toMatchObject({ onlyName: true });
		expect(dishes.find((d) => d.name === 'Linsgryta')).toMatchObject({
			ingredients: ['3 dl röda linser', '1 gul lök'],
			ingredientsGuessed: false
		});
	});

	it('knows what is in the basket by its lines, however the list is made', async () => {
		await planWeek();
		const claude = async (
			items: { text: string; lines: { recipeId: number; position: number }[] }[]
		) =>
			saveShoppingList(db, WEEK, {
				origin: 'claude',
				items: items.map((item) => ({ ...item, amount: null, section: 'Skafferi' })),
				basis: 'claude'
			});
		await claude([
			{ text: 'Torskfilé', lines: [await line('Fiskgratäng', 0)] },
			{ text: 'Lök', lines: [await line('Linsgryta', 1)] },
			{ text: 'Salt', lines: [] }
		]);
		await tick('Torskfilé');
		await tick('Lök');
		await tick('Salt');

		// Without Claude, the cod's line is in the basket already.
		await makeFromRecipes();
		expect(shown(await getShoppingList(db, WEEK)).filter((i) => !i.checked)).toEqual([
			{ text: '2 dl grädde', section: 'Fiskgratäng', origin: 'recipe', checked: false },
			{ text: '3 dl röda linser', section: 'Linsgryta', origin: 'recipe', checked: false }
		]);

		// With Claude again: an item that also needs a line not in the basket comes back, an item
		// without lines is known by its name, in any case.
		await claude([
			{ text: 'Gul lök', lines: [await line('Linsgryta', 1)] },
			{ text: 'Lök och grädde', lines: [await line('Linsgryta', 1), await line('Fiskgratäng', 1)] },
			{ text: 'salt', lines: [] }
		]);
		expect((await getShoppingList(db, WEEK)).filter((i) => !i.checked).map((i) => i.text)).toEqual([
			'Lök och grädde'
		]);
	});

	it('takes items by hand, which can be ticked off, unticked and removed', async () => {
		await addShoppingItem(db, WEEK, 'Kaffe');
		await addShoppingItem(db, WEEK, '   ');
		const [coffee] = await getShoppingList(db, WEEK);
		expect(shown([coffee])).toEqual([
			{ text: 'Kaffe', section: null, origin: 'hand', checked: false }
		]);

		await setShoppingItemChecked(db, coffee.id, true);
		expect((await getShoppingList(db, WEEK))[0].checked).toBe(true);
		await setShoppingItemChecked(db, coffee.id, false);
		expect((await getShoppingList(db, WEEK))[0].checked).toBe(false);

		await deleteShoppingItem(db, coffee.id);
		expect(await getShoppingList(db, WEEK)).toEqual([]);
	});

	it('removes any item, and puts it back as it was with its dishes', async () => {
		await planWeek();
		await makeFromRecipes();
		const before = await getShoppingList(db, WEEK);
		const onion = before.find((i) => i.text === '1 gul lök')!;
		await setShoppingItemChecked(db, onion.id, true);

		const removed = await deleteShoppingItem(db, onion.id);
		expect(removed).toMatchObject({ text: '1 gul lök', origin: 'recipe', checked: true });
		expect((await getShoppingList(db, WEEK)).map((i) => i.text)).not.toContain('1 gul lök');
		expect(await deleteShoppingItem(db, onion.id)).toBeNull();

		await restoreShoppingItem(db, WEEK, removed!);
		const after = await getShoppingList(db, WEEK);
		const shownItems = (list: typeof after) => list.map((i) => ({ ...i, id: 0 }));
		expect(shownItems(after)).toEqual(
			shownItems(before.map((i) => (i.id === onion.id ? { ...i, checked: true } : i)))
		);
	});

	it('takes an amount by hand, and puts back what Claude worked out', async () => {
		await planWeek();
		await saveShoppingList(db, WEEK, {
			origin: 'claude',
			items: [
				{ text: 'Torsk', amount: '400 g', section: 'Kött och fisk', lines: [] },
				{ text: 'Salt', amount: null, section: 'Finns kanske hemma', lines: [] }
			],
			basis: 'claude'
		});
		await addShoppingItem(db, WEEK, 'Kaffe');
		const amounts = async () =>
			(await getShoppingList(db, WEEK)).map(({ text, amount, amountEdited, amountBefore }) => ({
				text,
				amount,
				amountEdited,
				amountBefore
			}));
		const idOf = async (text: string) =>
			(await getShoppingList(db, WEEK)).find((i) => i.text === text)!.id;

		await setShoppingItemAmount(db, await idOf('Torsk'), ' 500  g ');
		await setShoppingItemAmount(db, await idOf('Torsk'), '600 g');
		await setShoppingItemAmount(db, await idOf('Salt'), '1 paket');
		// What is written by hand is never a change to Claude's list; blank is no amount.
		await setShoppingItemAmount(db, await idOf('Kaffe'), '2 förp');
		expect(await amounts()).toEqual([
			{ text: 'Torsk', amount: '600 g', amountEdited: true, amountBefore: '400 g' },
			{ text: 'Salt', amount: '1 paket', amountEdited: true, amountBefore: null },
			{ text: 'Kaffe', amount: '2 förp', amountEdited: false, amountBefore: null }
		]);

		// Back to Claude's amount, by hand or with the button.
		await setShoppingItemAmount(db, await idOf('Torsk'), '400 g');
		await resetShoppingItemAmount(db, await idOf('Salt'));
		await setShoppingItemAmount(db, await idOf('Kaffe'), '   ');
		expect(await amounts()).toEqual([
			{ text: 'Torsk', amount: '400 g', amountEdited: false, amountBefore: null },
			{ text: 'Salt', amount: null, amountEdited: false, amountBefore: null },
			{ text: 'Kaffe', amount: null, amountEdited: false, amountBefore: null }
		]);

		await setShoppingItemAmount(db, await idOf('Torsk'), 'x'.repeat(60));
		expect((await amounts())[0].amount).toBe('x'.repeat(40));
	});

	it('keeps an amount changed by hand when it is made again, while its dish is on the week', async () => {
		await planWeek();
		const claude = async (items: { text: string; amount: string; lines: Line[] }[]) =>
			saveShoppingList(db, WEEK, {
				origin: 'claude',
				items: items.map((item) => ({ ...item, section: 'Skafferi' })),
				basis: 'claude'
			});
		const list = async () =>
			(await getShoppingList(db, WEEK)).map(({ text, amount, amountEdited }) => ({
				text,
				amount,
				amountEdited
			}));
		await claude([
			{ text: 'Torsk', amount: '400 g', lines: [await line('Fiskgratäng', 0)] },
			{ text: 'Gul lök', amount: '1 st', lines: [await line('Linsgryta', 1)] }
		]);
		const [cod, onion] = await getShoppingList(db, WEEK);
		await setShoppingItemAmount(db, cod.id, '500 g');
		await setShoppingItemAmount(db, onion.id, '2 st');

		// Claude's new items for the same lines are not added beside them, nor counted anew.
		await claude([
			{ text: 'Torskfilé', amount: '800 g', lines: [await line('Fiskgratäng', 0)] },
			{ text: 'Lök', amount: '2 st', lines: [await line('Linsgryta', 1)] },
			{ text: 'Grädde', amount: '2 dl', lines: [await line('Fiskgratäng', 1)] }
		]);
		expect(await list()).toEqual([
			{ text: 'Torsk', amount: '500 g', amountEdited: true },
			{ text: 'Gul lök', amount: '2 st', amountEdited: true },
			{ text: 'Grädde', amount: '2 dl', amountEdited: false }
		]);

		// The lentil stew leaves the week, and its onion with it.
		await setWeekRow(db, WEEK, dinner(2, 'Tacos'), []);
		await setWeekRow(db, WEEK, dinner(4, 'Tacos'), []);
		await makeFromRecipes();
		expect((await list()).map((i) => i.text)).toEqual(['Torsk', '2 dl grädde']);
	});

	it('asks about a changed amount when its dishes change, and never lists it twice', async () => {
		await planWeek();
		await giveIngredients(db, 'Pannkakor', ['3 dl vetemjöl', '1 gul lök']);
		const claude = async (items: { text: string; amount: string; lines: Line[] }[]) =>
			saveShoppingList(db, WEEK, {
				origin: 'claude',
				items: items.map((item) => ({ ...item, section: 'Frukt och grönt' })),
				basis: 'claude'
			});
		const list = async () =>
			(await getShoppingList(db, WEEK)).map(
				({ text, amount, amountEdited, amountChange, amountSuggested, dishes }) => ({
					text,
					amount,
					amountEdited,
					amountChange,
					amountSuggested,
					dishes: dishes.map((d) => d.name)
				})
			);
		const onion = { text: 'Gul lök', amountEdited: true };
		await claude([{ text: 'Gul lök', amount: '1 st', lines: [await line('Linsgryta', 1)] }]);
		await setShoppingItemAmount(db, (await getShoppingList(db, WEEK))[0].id, '3 st');

		// Made again with the same dishes: kept as it is, with no question.
		await claude([{ text: 'Lök', amount: '2 st', lines: [await line('Linsgryta', 1)] }]);
		expect(await list()).toEqual([
			{ ...onion, amount: '3 st', amountChange: null, amountSuggested: null, dishes: ['Linsgryta'] }
		]);

		// The pancakes have onion too: Claude's new item is taken into the changed one, which asks.
		const both = [await line('Linsgryta', 1), await line('Pannkakor', 1)];
		await claude([{ text: 'Gul lök', amount: '4 st', lines: both }]);
		expect(await list()).toEqual([
			{
				...onion,
				amount: '3 st',
				amountChange: 'added',
				amountSuggested: '4 st',
				dishes: ['Linsgryta', 'Pannkakor']
			}
		]);

		// Keeping it asks no more, and it stays the household's.
		const [item] = await getShoppingList(db, WEEK);
		await keepShoppingItemAmount(db, WEEK, item.id);
		expect((await list())[0]).toMatchObject({
			amount: '3 st',
			amountChange: null,
			amountEdited: true
		});

		// The lentil stew leaves the week: the item asks again, and is no longer for it.
		await setWeekRow(db, WEEK, dinner(2, 'Tacos'), []);
		await setWeekRow(db, WEEK, dinner(4, 'Tacos'), []);
		await claude([{ text: 'Gul lök', amount: '1 st', lines: [await line('Pannkakor', 1)] }]);
		expect(await list()).toEqual([
			{
				...onion,
				amount: '3 st',
				amountChange: 'removed',
				amountSuggested: '1 st',
				dishes: ['Pannkakor']
			}
		]);

		// Taking Claude's makes it Claude's again, so the next list counts it anew.
		await takeSuggestedAmount(db, WEEK, item.id);
		expect((await list())[0]).toMatchObject({
			amount: '1 st',
			amountEdited: false,
			amountChange: null,
			amountSuggested: null
		});
	});

	it('asks nothing when Claude splits or merges changed items differently, and loses no item', async () => {
		await planWeek();
		await giveIngredients(db, 'Pannkakor', ['3 dl vetemjöl', '1 gul lök']);
		const make = async (items: { text: string; amount: string; lines: Line[] }[]) =>
			saveShoppingList(db, WEEK, {
				origin: 'claude',
				items: items.map((item) => ({ ...item, section: 'x' })),
				basis: 'claude'
			});
		const list = async () =>
			(await getShoppingList(db, WEEK)).map(({ text, amount, amountChange }) => ({
				text,
				amount,
				amountChange
			}));
		const [lentil, cod, pancake] = [
			await line('Linsgryta', 1),
			await line('Fiskgratäng', 0),
			await line('Pannkakor', 1)
		];
		await make([
			{ text: 'Lök', amount: '1 st', lines: [lentil] },
			{ text: 'Torsk', amount: '400 g', lines: [cod] }
		]);
		for (const item of await getShoppingList(db, WEEK))
			await setShoppingItemAmount(db, item.id, '9');

		// One new item for both changed ones: neither asks, and it is not added beside them.
		await make([{ text: 'Lök och torsk', amount: '2', lines: [lentil, cod] }]);
		expect(await list()).toEqual([
			{ text: 'Lök', amount: '9', amountChange: null },
			{ text: 'Torsk', amount: '9', amountChange: null }
		]);

		// A changed item split in two, one with a new dish: the new dish's item stays.
		const [onion] = await getShoppingList(db, WEEK);
		await deleteShoppingItem(db, (await getShoppingList(db, WEEK))[1].id);
		await restoreShoppingItem(db, WEEK, {
			...(await deleteShoppingItem(db, onion.id))!,
			lines: [lentil, cod]
		});
		await make([
			{ text: 'Lök', amount: '1 st', lines: [lentil] },
			{ text: 'Torsk', amount: '500 g', lines: [cod, pancake] }
		]);
		expect(await list()).toEqual([
			{ text: 'Lök', amount: '9', amountChange: null },
			{ text: 'Torsk', amount: '500 g', amountChange: null }
		]);
	});

	it('asks nothing when Claude counts what the household already wrote', async () => {
		await planWeek();
		await giveIngredients(db, 'Pannkakor', ['3 dl vetemjöl', '1 gul lök']);
		await saveShoppingList(db, WEEK, {
			origin: 'claude',
			items: [
				{ text: 'Gul lök', amount: '1 st', section: 'x', lines: [await line('Linsgryta', 1)] }
			],
			basis: 'claude'
		});
		await setShoppingItemAmount(db, (await getShoppingList(db, WEEK))[0].id, '2 st');
		await saveShoppingList(db, WEEK, {
			origin: 'claude',
			items: [
				{
					text: 'Gul lök',
					amount: '2 st',
					section: 'x',
					lines: [await line('Linsgryta', 1), await line('Pannkakor', 1)]
				}
			],
			basis: 'claude'
		});
		const items = await getShoppingList(db, WEEK);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ amount: '2 st', amountChange: null, amountSuggested: null });
	});

	it('knows Å, Ä and Ö in either case for an item without lines', async () => {
		await planWeek();
		const make = (text: string) =>
			saveShoppingList(db, WEEK, {
				origin: 'claude',
				items: [{ text, amount: null, section: 'Mejeri', lines: [] }],
				basis: 'claude'
			});
		await make('Ägg');
		await tick('Ägg');
		await make('ägg');
		expect((await getShoppingList(db, WEEK)).map((i) => i.text)).toEqual(['Ägg']);
	});

	it('keeps a changed amount when an item is removed and put back', async () => {
		await addShoppingItem(db, WEEK, 'Kaffe');
		await saveShoppingList(db, WEEK, {
			origin: 'claude',
			items: [{ text: 'Torsk', amount: '400 g', section: 'Kött och fisk', lines: [] }],
			basis: 'claude'
		});
		const cod = (await getShoppingList(db, WEEK)).find((i) => i.text === 'Torsk')!;
		await setShoppingItemAmount(db, cod.id, '500 g');

		const removed = await deleteShoppingItem(db, cod.id);
		expect(removed).toMatchObject({ amount: '500 g', amountEdited: true, amountBefore: '400 g' });
		await restoreShoppingItem(db, WEEK, removed!);
		expect((await getShoppingList(db, WEEK)).find((i) => i.text === 'Torsk')).toMatchObject({
			amount: '500 g',
			amountEdited: true,
			amountBefore: '400 g'
		});
	});

	it('keeps who eats when the list starts the week', async () => {
		const kim = await createPerson(db, { name: 'Kim', requirements: '' });
		await setWeekRow(db, '2030-02-25', dinner(1, 'Tacos'), [kim]);
		await addShoppingItem(db, WEEK, 'Kaffe');
		expect((await getWeek(db, WEEK)).eaters).toEqual([kim]);
	});
});
