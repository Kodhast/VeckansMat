import { error, fail } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { askFor } from '#lib/server/claude/claude.ts';
import {
	addShoppingItem,
	deleteShoppingItem,
	getShoppingBasis,
	getShoppingList,
	keepShoppingItemAmount,
	resetShoppingItemAmount,
	restoreShoppingItem,
	setShoppingItemAmount,
	setShoppingItemChecked,
	takeSuggestedAmount,
	type Line,
	type RemovedItem
} from '#lib/server/db/shopping.ts';
import {
	listChanged,
	makeShoppingListWithClaude,
	shoppingPlan,
	ShoppingListError
} from '#lib/server/shopping-make.ts';
import { weekOf } from '#lib/server/forms.ts';
import { shownWeek } from '#lib/weeks.ts';
import type { Actions, PageServerLoad } from './$types';

// The same week as Veckan shows.
export const load: PageServerLoad = async ({ url }) => {
	const { weekStart, thisWeek, nextWeek } = shownWeek(url.searchParams.get('vecka'));
	const [items, plan, basis] = await Promise.all([
		getShoppingList(env.DB, weekStart),
		shoppingPlan(env.DB, weekStart),
		getShoppingBasis(env.DB, weekStart)
	]);
	return {
		weekStart,
		thisWeek,
		nextWeek,
		items,
		dishes: plan.dishes.map(({ id, name, ingredients }) => ({
			id,
			name,
			hasIngredients: ingredients.length > 0
		})),
		changed: listChanged(basis, plan.basis, items),
		basis: plan.basis
	};
};

const askShopping = askFor('shopping');

function idOf(form: FormData): number {
	const id = Number(form.get('id') || NaN);
	if (!Number.isInteger(id)) error(400, 'Okänd vara');
	return id;
}

/** The item to put back, as `remove` answered with it. */
function removedOf(form: FormData): RemovedItem {
	try {
		const item = JSON.parse(String(form.get('item')));
		const text = typeof item.text === 'string' ? item.text.trim().slice(0, 200) : '';
		const textOrNull = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : null);
		// A hand item has no amount of Claude's to go back to (ADR 0027).
		const amountEdited = item.amountEdited === true && item.origin !== 'hand';
		if (
			text &&
			Number.isInteger(item.position) &&
			['recipe', 'claude', 'hand'].includes(item.origin) &&
			Array.isArray(item.lines)
		) {
			return {
				text,
				position: item.position,
				amount: textOrNull(item.amount),
				amountEdited,
				amountBefore: amountEdited ? textOrNull(item.amountBefore) : null,
				section: textOrNull(item.section),
				origin: item.origin,
				checked: item.checked === true,
				lines: item.lines
					.filter(
						(l: Partial<Line>) => Number.isInteger(l?.recipeId) && Number.isInteger(l?.position)
					)
					.map(({ recipeId, position }: Line) => ({ recipeId, position }))
			};
		}
	} catch {
		// Not JSON.
	}
	error(400, 'Okänd vara');
}

export const actions: Actions = {
	make: async ({ request }) => {
		try {
			await makeShoppingListWithClaude(env.DB, weekOf(await request.formData()), askShopping);
		} catch (e) {
			// The list is made of the recipes' lines instead, and the page says why.
			if (e instanceof ShoppingListError) return fail(503, { shoppingError: e.reason });
			throw e;
		}
	},
	// A change answers with the list, so the page shows it without loading again. The week is read
	// before anything is written, so a form with an unknown week changes nothing.
	add: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await addShoppingItem(env.DB, weekStart, String(form.get('text') ?? '').slice(0, 200));
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	check: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await setShoppingItemChecked(env.DB, idOf(form), form.get('checked') === 'true');
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	// An amount written in; blank is none.
	amount: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await setShoppingItemAmount(env.DB, idOf(form), String(form.get('amount') ?? '').slice(0, 200));
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	// "Som Claude räknade": the amount before it was changed.
	resetAmount: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await resetShoppingItemAmount(env.DB, idOf(form));
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	// The dishes changed since the amount was changed by hand: keep it, or take Claude's (#197).
	keepAmount: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await keepShoppingItemAmount(env.DB, weekStart, idOf(form));
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	takeSuggested: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await takeSuggestedAmount(env.DB, weekStart, idOf(form));
		return { items: await getShoppingList(env.DB, weekStart) };
	},
	// Answers with what was removed too, which the page sends back to undo it.
	remove: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		const removed = await deleteShoppingItem(env.DB, idOf(form));
		return { items: await getShoppingList(env.DB, weekStart), removed };
	},
	restore: async ({ request }) => {
		const form = await request.formData();
		const weekStart = weekOf(form);
		await restoreShoppingItem(env.DB, weekStart, removedOf(form));
		return { items: await getShoppingList(env.DB, weekStart) };
	}
};
