import { cleanText } from '../../names';
import { LUNCHBOX_TAG } from '../../recipes';
import { ensureMenu } from './menus';
import { guessIngredientsStatements } from './recipes';

type Origin = 'recipe' | 'claude' | 'hand';

/** How an item's dishes changed after its amount was changed by hand. */
export type AmountChange = 'added' | 'removed' | 'changed';

/** A dish an item is for, and whether its lines are Claude's guess. */
export interface ItemDish {
	name: string;
	guessed: boolean;
}

export interface ShoppingItem {
	id: number;
	text: string;
	/** How much, such as "400 g", when Claude has worked it out or it has been written in. */
	amount: string | null;
	/** Whether the amount was changed by hand, which keeps the item when the list is made again. */
	amountEdited: boolean;
	/** The amount before it was changed by hand, which "Som Claude räknade" puts back. */
	amountBefore: string | null;
	/**
	 * How the dishes of an item changed by hand have changed since, when they have: the item then
	 * asks whether to keep its amount or take Claude's new one, `amountSuggested`.
	 */
	amountChange: AmountChange | null;
	/** What Claude counts now, when the dishes have changed, or null when it has no new amount. */
	amountSuggested: string | null;
	/** The heading the item is listed under: the store section, or the dish for a recipe's line. */
	section: string | null;
	/** The dishes whose lines the item covers, in the order its lines were given. */
	dishes: ItemDish[];
	origin: Origin;
	checked: boolean;
}

/** A dish on the week. */
export interface WeekDish {
	id: number;
	name: string;
	servings: number | null;
	/** The ingredient lines as written. */
	ingredients: string[];
	ingredientsGuessed: boolean;
	lunchbox: boolean;
	/** How many dinners and lunches of the week it is. */
	times: number;
}

/** The week's dishes, each once, with when it is first eaten and how often, as `days`. */
const WEEK_DISHES = `WITH days AS (
	SELECT i.recipe_id, min(i.weekday * 2 + (i.meal = 'dinner')) AS first, count(*) AS times
	FROM menu_item i JOIN menu m ON m.id = i.menu_id
	WHERE m.week_start = ?1 AND i.weekday IS NOT NULL AND i.recipe_id IS NOT NULL
	GROUP BY i.recipe_id)`;

/** The dishes on a week, each once, in the order they are first eaten. */
export async function weekDishes(db: D1Database, weekStart: string): Promise<WeekDish[]> {
	const { results } = await db
		.prepare(
			`${WEEK_DISHES}
			 SELECT r.id, r.name, r.servings, r.ingredients_guessed AS ingredientsGuessed, d.times,
			   EXISTS (SELECT 1 FROM recipe_tag t WHERE t.recipe_id = r.id AND t.tag = ?2) AS lunchbox,
			   (SELECT json_group_array(raw) FROM
			     (SELECT raw FROM recipe_ingredient WHERE recipe_id = r.id ORDER BY position)) AS ingredients
			 FROM days d JOIN recipe r ON r.id = d.recipe_id
			 ORDER BY d.first`
		)
		.bind(weekStart, LUNCHBOX_TAG)
		.all<
			Omit<WeekDish, 'ingredients' | 'ingredientsGuessed' | 'lunchbox'> & {
				ingredients: string;
				ingredientsGuessed: number;
				lunchbox: number;
			}
		>();
	return results.map((dish) => ({
		...dish,
		ingredients: JSON.parse(dish.ingredients),
		ingredientsGuessed: Boolean(dish.ingredientsGuessed),
		lunchbox: Boolean(dish.lunchbox)
	}));
}

/** The week's shopping list in the order it was written. */
export async function getShoppingList(db: D1Database, weekStart: string): Promise<ShoppingItem[]> {
	const { results } = await db
		.prepare(
			`SELECT s.id, s.text, s.amount, s.amount_edited AS amountEdited, s.amount_before AS amountBefore,
			   s.amount_change AS amountChange, s.amount_suggested AS amountSuggested, s.section, s.origin, s.checked,
			   (SELECT json_group_array(json_object('name', name, 'guessed', guessed)) FROM
			     (SELECT r.name, r.ingredients_guessed AS guessed
			      FROM shopping_item_source l JOIN recipe r ON r.id = l.recipe_id
			      WHERE l.item_id = s.id GROUP BY r.id ORDER BY min(l.rowid))) AS dishes
			 FROM shopping_item s JOIN menu m ON m.id = s.menu_id
			 WHERE m.week_start = ? ORDER BY s.position, s.id`
		)
		.bind(weekStart)
		.all<
			Omit<ShoppingItem, 'checked' | 'amountEdited' | 'dishes'> & {
				checked: number;
				amountEdited: number;
				dishes: string;
			}
		>();
	return results.map((item) => ({
		...item,
		checked: Boolean(item.checked),
		amountEdited: Boolean(item.amountEdited),
		dishes: (JSON.parse(item.dishes) as { name: string; guessed: number }[]).map((dish) => ({
			name: dish.name,
			guessed: Boolean(dish.guessed)
		}))
	}));
}

/** What the week's list was made from, or null when it has not been made. */
export async function getShoppingBasis(db: D1Database, weekStart: string): Promise<string | null> {
	const row = await db
		.prepare('SELECT shopping_basis AS basis FROM menu WHERE week_start = ?')
		.bind(weekStart)
		.first<{ basis: string | null }>();
	return row?.basis ?? null;
}

/** A recipe line, by its dish and its position among the dish's lines. */
export interface Line {
	recipeId: number;
	position: number;
}

/** An item for the new list, with the recipe lines it covers. */
export interface NewShoppingItem {
	text: string;
	amount: string | null;
	section: string;
	lines: Line[];
}

/** Ingredients Claude guessed for a dish that had only a name. */
export interface Guess {
	recipeId: number;
	ingredients: string[];
}

/** Text in lower case, also Å, Ä and Ö, which SQLite's lower() leaves as they are. */
const lowerSv = (column: string) =>
	`lower(replace(replace(replace(${column}, 'Å', 'å'), 'Ä', 'ä'), 'Ö', 'ö'))`;

/** Items changed by hand that are not in the basket, which ask when their dishes change. */
const edited = (e: string) =>
	`${e}.menu_id = ?1 AND ${e}.checked = 0 AND ${e}.amount_edited = 1 AND ${e}.origin <> 'hand'`;
/** Items just added for the new list: the only ones out of the basket that are neither written by
 * hand nor changed by hand, once the old ones are deleted. */
const fresh = (n: string) =>
	`${n}.menu_id = ?1 AND ${n}.checked = 0 AND ${n}.amount_edited = 0 AND ${n}.origin <> 'hand'`;
/** Whether item n covers a line of item e. */
const shares = (n: string, e: string) => `EXISTS (SELECT 1 FROM shopping_item_source a
	JOIN shopping_item_source b ON b.recipe_id = a.recipe_id AND b.position = a.position
	WHERE a.item_id = ${n}.id AND b.item_id = ${e}.id)`;
/** Whether the line a is in the basket. */
const IN_BASKET = `EXISTS (SELECT 1 FROM shopping_item_source k JOIN shopping_item c ON c.id = k.item_id
	WHERE c.menu_id = ?1 AND c.checked = 1 AND k.recipe_id = a.recipe_id AND k.position = a.position)`;
const EDITED = edited('e');
const FRESH = fresh('n');
/**
 * Whether the new item n is Claude's count of the changed item e: they share a line, and neither
 * shares one with another item. When Claude splits or merges items differently, which one counts
 * for which is not clear, so the items are left as they were before #197.
 */
const PAIR = `${shares('n', 'e')}
	AND (SELECT count(*) FROM shopping_item n2 WHERE ${fresh('n2')} AND ${shares('n2', 'e')}) = 1
	AND (SELECT count(*) FROM shopping_item e2 WHERE ${edited('e2')} AND ${shares('n', 'e2')}) = 1`;
/** Whether item n covers a line item e does not, and that is not in the basket. */
const HAS_MORE = `EXISTS (SELECT 1 FROM shopping_item_source a WHERE a.item_id = n.id AND NOT ${IN_BASKET}
	AND NOT EXISTS (SELECT 1 FROM shopping_item_source b WHERE b.item_id = e.id
	  AND b.recipe_id = a.recipe_id AND b.position = a.position))`;
/** Whether the dish is on the week. */
const ON_WEEK = (recipe: string) =>
	`EXISTS (SELECT 1 FROM menu_item i WHERE i.recipe_id = ${recipe} AND i.menu_id = ?1 AND i.weekday IS NOT NULL)`;

/**
 * Saves the week's list in place of the one before, with what it was made from (`basis`) and the
 * ingredients Claude guessed. What was written by hand and what is in the basket stays. An item
 * whose amount was changed by hand stays while a dish of its is on the week; when its dishes have
 * changed since, it takes in Claude's new item for the same lines and asks whether to keep its
 * amount or take Claude's (#197). An item whose lines are all covered by items in the basket or
 * changed by hand is not added again; an item that covers no line is known by its text instead.
 * All in one batch, so the basket is read as it is when the list is written.
 */
export async function saveShoppingList(
	db: D1Database,
	weekStart: string,
	list: { origin: 'recipe' | 'claude'; items: NewShoppingItem[]; guesses?: Guess[]; basis: string }
): Promise<void> {
	const menuId = await ensureMenu(db, weekStart);
	await db.batch([
		db
			.prepare(
				`DELETE FROM shopping_item AS s
				 WHERE s.menu_id = ?1 AND s.origin <> 'hand' AND s.checked = 0 AND (s.amount_edited = 0
				   OR EXISTS (SELECT 1 FROM shopping_item_source WHERE item_id = s.id) AND NOT EXISTS
				     (SELECT 1 FROM shopping_item_source l JOIN menu_item i ON i.recipe_id = l.recipe_id
				      WHERE l.item_id = s.id AND i.menu_id = ?1 AND i.weekday IS NOT NULL))`
			)
			.bind(menuId),
		// A changed item that lost a dish says so, and is no longer for that dish.
		db
			.prepare(
				`UPDATE shopping_item AS e
				 SET amount_change = CASE WHEN e.amount_change IN ('added', 'changed') THEN 'changed' ELSE 'removed' END,
				   amount_suggested = NULL
				 WHERE ${EDITED} AND EXISTS (SELECT 1 FROM shopping_item_source l
				   WHERE l.item_id = e.id AND NOT ${ON_WEEK('l.recipe_id')})`
			)
			.bind(menuId),
		db
			.prepare(
				`DELETE FROM shopping_item_source AS l
				 WHERE NOT ${ON_WEEK('l.recipe_id')} AND EXISTS
				   (SELECT 1 FROM shopping_item e WHERE e.id = l.item_id AND ${EDITED})`
			)
			.bind(menuId),
		db.prepare('UPDATE menu SET shopping_basis = ? WHERE id = ?').bind(list.basis, menuId),
		...(list.guesses ?? []).flatMap((g) =>
			guessIngredientsStatements(db, g.recipeId, g.ingredients)
		),
		// A batch is one transaction, so the newest item is the one inserted just before its lines.
		...list.items.flatMap((item) => [
			db
				.prepare(
					`INSERT INTO shopping_item (menu_id, position, text, amount, section, origin)
					 SELECT ?1, (SELECT coalesce(max(position) + 1, 0) FROM shopping_item WHERE menu_id = ?1),
					   ?2, ?3, ?4, ?5`
				)
				.bind(menuId, item.text, item.amount, item.section, list.origin),
			db
				.prepare(
					`INSERT OR IGNORE INTO shopping_item_source (item_id, recipe_id, position)
					 SELECT (SELECT max(id) FROM shopping_item), value ->> '$.recipeId', value ->> '$.position'
					 FROM json_each(?)`
				)
				.bind(JSON.stringify(item.lines))
		]),
		// A changed item whose dishes changed takes what Claude counts now for the same lines, and
		// a new dish's line says so. One whose dishes are as they were is left as it is.
		db
			.prepare(
				`UPDATE shopping_item AS e SET
				   amount_change = CASE
				     WHEN NOT EXISTS (SELECT 1 FROM shopping_item n WHERE ${FRESH} AND ${PAIR} AND ${HAS_MORE})
				       THEN e.amount_change
				     WHEN e.amount_change IN ('removed', 'changed') THEN 'changed'
				     ELSE 'added' END,
				   amount_suggested = (SELECT n.amount FROM shopping_item n
				     WHERE ${FRESH} AND ${PAIR} ORDER BY n.id LIMIT 1)
				 WHERE ${EDITED} AND EXISTS (SELECT 1 FROM shopping_item n WHERE ${FRESH} AND ${PAIR}
				   AND (e.amount_change IS NOT NULL OR ${HAS_MORE}))`
			)
			.bind(menuId),
		// The changed item covers the new lines too, so Claude's new item is not added beside it.
		db
			.prepare(
				`INSERT OR IGNORE INTO shopping_item_source (item_id, recipe_id, position)
				 SELECT e.id, a.recipe_id, a.position
				 FROM shopping_item e JOIN shopping_item n ON ${FRESH} AND ${PAIR}
				   JOIN shopping_item_source a ON a.item_id = n.id
				 WHERE ${EDITED} AND e.amount_change IS NOT NULL AND NOT ${IN_BASKET}`
			)
			.bind(menuId),
		// Claude counting what the household already has is no question.
		db
			.prepare(
				`UPDATE shopping_item AS e SET amount_change = NULL, amount_suggested = NULL
				 WHERE ${EDITED} AND e.amount_suggested = e.amount`
			)
			.bind(menuId),
		// The items just added are the only ones left out of the basket that are neither written by
		// hand nor changed by hand; those that stay are kept, c below.
		db
			.prepare(
				`DELETE FROM shopping_item AS s
				 WHERE s.menu_id = ?1 AND s.checked = 0 AND s.amount_edited = 0 AND s.origin <> 'hand' AND CASE
				   WHEN EXISTS (SELECT 1 FROM shopping_item_source WHERE item_id = s.id)
				   THEN NOT EXISTS (SELECT 1 FROM shopping_item_source l WHERE l.item_id = s.id AND NOT EXISTS
				     (SELECT 1 FROM shopping_item_source b JOIN shopping_item c ON c.id = b.item_id
				      WHERE c.menu_id = ?1 AND (c.checked = 1 OR c.amount_edited = 1)
				        AND b.recipe_id = l.recipe_id AND b.position = l.position))
				   ELSE EXISTS (SELECT 1 FROM shopping_item c
				     WHERE c.menu_id = ?1 AND (c.checked = 1 OR c.amount_edited = 1) AND c.origin <> 'hand'
				       AND ${lowerSv('c.text')} = ${lowerSv('s.text')})
				 END`
			)
			.bind(menuId)
	]);
}

/** Adds an item written by hand. Blank text adds nothing. */
export async function addShoppingItem(
	db: D1Database,
	weekStart: string,
	text: string
): Promise<void> {
	const clean = cleanText(text);
	if (!clean) return;
	await db
		.prepare(
			`INSERT INTO shopping_item (menu_id, position, text, origin)
			 SELECT ?1, (SELECT coalesce(max(position) + 1, 0) FROM shopping_item WHERE menu_id = ?1), ?2, 'hand'`
		)
		.bind(await ensureMenu(db, weekStart), clean)
		.run();
}

export async function setShoppingItemChecked(
	db: D1Database,
	id: number,
	checked: boolean
): Promise<void> {
	await db
		.prepare('UPDATE shopping_item SET checked = ? WHERE id = ?')
		.bind(checked ? 1 : 0, id)
		.run();
}

/** The longest amount that is kept; more is cut. */
export const AMOUNT_MAX = 40;

/**
 * Gives an item another amount, written by hand; blank is no amount. An item that is not written
 * by hand is marked as changed and keeps what it had before, unless the amount is that again.
 */
export async function setShoppingItemAmount(
	db: D1Database,
	id: number,
	amount: string
): Promise<void> {
	const clean = cleanText(amount).slice(0, AMOUNT_MAX).trim() || null;
	await db
		.prepare(
			`UPDATE shopping_item SET amount = ?2, amount_change = NULL, amount_suggested = NULL,
			   amount_edited = (origin <> 'hand' AND ?2 IS NOT o.before),
			   amount_before = CASE WHEN origin <> 'hand' AND ?2 IS NOT o.before THEN o.before END
			 FROM (SELECT CASE WHEN amount_edited = 1 THEN amount_before ELSE amount END AS before
			       FROM shopping_item WHERE id = ?1) AS o
			 WHERE id = ?1`
		)
		.bind(id, clean)
		.run();
}

/** Puts back the amount an item had before it was changed by hand. */
export async function resetShoppingItemAmount(db: D1Database, id: number): Promise<void> {
	await db
		.prepare(
			`UPDATE shopping_item SET amount = amount_before, amount_before = NULL, amount_edited = 0,
			   amount_change = NULL, amount_suggested = NULL
			 WHERE id = ? AND amount_edited = 1`
		)
		.bind(id)
		.run();
}

/** Keeps the amount changed by hand after the dishes changed, and asks no more. */
export async function keepShoppingItemAmount(
	db: D1Database,
	weekStart: string,
	id: number
): Promise<void> {
	await db
		.prepare(
			`UPDATE shopping_item SET amount_change = NULL, amount_suggested = NULL
			 WHERE id = ? AND menu_id = (SELECT id FROM menu WHERE week_start = ?)`
		)
		.bind(id, weekStart)
		.run();
}

/** Takes what Claude counts now in place of the amount changed by hand; it is Claude's again. */
export async function takeSuggestedAmount(
	db: D1Database,
	weekStart: string,
	id: number
): Promise<void> {
	await db
		.prepare(
			`UPDATE shopping_item SET amount = amount_suggested, amount_edited = 0, amount_before = NULL,
			   amount_change = NULL, amount_suggested = NULL
			 WHERE id = ? AND menu_id = (SELECT id FROM menu WHERE week_start = ?)
			   AND amount_suggested IS NOT NULL`
		)
		.bind(id, weekStart)
		.run();
}

/** An item as it was when it was removed, with the recipe lines it covered, to put it back. */
export interface RemovedItem {
	position: number;
	text: string;
	amount: string | null;
	amountEdited: boolean;
	amountBefore: string | null;
	section: string | null;
	origin: Origin;
	checked: boolean;
	lines: Line[];
}

/** Removes an item, and answers with what it was, or null when it was already gone. */
export async function deleteShoppingItem(db: D1Database, id: number): Promise<RemovedItem | null> {
	// The lines go with the item (ON DELETE CASCADE), so they are read first, in the same batch.
	const [lines, items] = await db.batch<unknown>([
		db
			.prepare('SELECT recipe_id AS recipeId, position FROM shopping_item_source WHERE item_id = ?')
			.bind(id),
		db
			.prepare(
				`DELETE FROM shopping_item WHERE id = ?
				 RETURNING position, text, amount, amount_edited AS amountEdited, amount_before AS amountBefore,
				   section, origin, checked`
			)
			.bind(id)
	]);
	const item = (
		items.results as (Omit<RemovedItem, 'checked' | 'amountEdited' | 'lines'> & {
			checked: number;
			amountEdited: number;
		})[]
	)[0];
	if (!item) return null;
	return {
		...item,
		checked: Boolean(item.checked),
		amountEdited: Boolean(item.amountEdited),
		lines: lines.results as Line[]
	};
}

/** Puts a removed item back where it was on the week's list, with the lines of dishes that still exist. */
export async function restoreShoppingItem(
	db: D1Database,
	weekStart: string,
	item: RemovedItem
): Promise<void> {
	const menuId = await ensureMenu(db, weekStart);
	await db.batch([
		db
			.prepare(
				`INSERT INTO shopping_item
				   (menu_id, position, text, amount, amount_edited, amount_before, section, origin, checked)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				menuId,
				item.position,
				item.text,
				item.amount,
				item.amountEdited ? 1 : 0,
				item.amountEdited ? item.amountBefore : null,
				item.section,
				item.origin,
				item.checked ? 1 : 0
			),
		// A batch is one transaction, so the newest item is the one just inserted.
		db
			.prepare(
				`INSERT OR IGNORE INTO shopping_item_source (item_id, recipe_id, position)
				 SELECT (SELECT max(id) FROM shopping_item), value ->> '$.recipeId', value ->> '$.position'
				 FROM json_each(?) WHERE EXISTS (SELECT 1 FROM recipe WHERE id = value ->> '$.recipeId')`
			)
			.bind(JSON.stringify(item.lines))
	]);
}
