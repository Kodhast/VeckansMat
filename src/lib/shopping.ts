import type { IconName } from './Icon.svelte';

/** The parts of the store, in the order the shopping list shows them. */
export const SECTIONS = [
	'Frukt och grönt',
	'Kött och fisk',
	'Mejeri och ägg',
	'Bröd',
	'Skafferi',
	'Fryst',
	'Övrigt',
	'Finns kanske hemma'
] as const;

export type Section = (typeof SECTIONS)[number];

/** How a heading of the list looks: an icon on a small coloured shape. */
export interface Look {
	icon: IconName;
	tint: string;
	ink: string;
	/** The shape's border-radius, so that the headings differ by more than colour. */
	shape: string;
}

/** The look of each section, fixed rather than from the theme, like the sorts of dish. */
export const SECTION_LOOKS: Record<Section, Look> = {
	'Frukt och grönt': {
		icon: 'produce',
		tint: '#d8ecc9',
		ink: '#2c4a1a',
		shape: '50% 50% 50% 0.375rem'
	},
	'Kött och fisk': {
		icon: 'kott',
		tint: '#f1d9cc',
		ink: '#5a2c18',
		shape: '0.5rem 0.5rem 0.25rem 0.25rem'
	},
	'Mejeri och ägg': { icon: 'dairy', tint: '#d3e4f5', ink: '#1d3a57', shape: '0.625rem' },
	Bröd: { icon: 'bread', tint: '#f6e0c4', ink: '#5a3a12', shape: '50% 50% 0.375rem 0.375rem' },
	Skafferi: { icon: 'pantry', tint: '#f7e3b0', ink: '#56400a', shape: '0.375rem' },
	Fryst: { icon: 'frozen', tint: '#dde6f0', ink: '#24384d', shape: '50%' },
	Övrigt: { icon: 'ovrigt', tint: '#e6e0f0', ink: '#3b3150', shape: '50% 0.375rem 50% 0.375rem' },
	'Finns kanske hemma': {
		icon: 'home',
		tint: '#ece6df',
		ink: '#4a3f39',
		shape: '0.625rem 0.625rem 50% 50%'
	}
};

/** The look of what is written by hand, and of a heading that is a dish rather than a section. */
export const HAND_LOOK: Look = {
	icon: 'edit',
	tint: 'var(--kh-primary-container)',
	ink: 'var(--kh-on-primary-container)',
	shape: '0.625rem'
};
export const BASKET_LOOK: Look = {
	icon: 'check',
	tint: 'var(--app-fill)',
	ink: 'var(--kh-on-surface-variant)',
	shape: '50%'
};
export const DISH_LOOK: Look = {
	icon: 'dishes',
	tint: '#ece6df',
	ink: '#4a3f39',
	shape: '0.625rem'
};

/** The look of a heading: its section's, or a dish's when it is not a section. */
export const lookOf = (heading: string): Look =>
	(SECTION_LOOKS as Record<string, Look>)[heading] ?? DISH_LOOK;

/** Where a heading goes: the store's sections in their order, any other heading after them. */
export function sectionRank(section: string | null): number {
	const rank = (SECTIONS as readonly (string | null)[]).indexOf(section);
	return rank < 0 ? SECTIONS.length : rank;
}

/** How much − and + change an amount: 100 for grams, a half for kilos and litres, else one. */
function stepOf(unit: string): number {
	const lower = unit.toLowerCase();
	if (lower === 'g' || lower === 'gram') return 100;
	if (['kg', 'kilo', 'l', 'liter'].includes(lower)) return 0.5;
	return 1;
}

/** What after a number makes it part of a larger one: a fraction, a range or a thousands group. */
const PART_OF_MORE = /^(?:\s*[/–-]\s*\d|\s+\d+\s*\/|\s\d{3}(?!\d)|\s*[½¼¾⅓⅔])/;

/**
 * The amount with its first number one step up (`direction` 1) or down (−1), in the unit after it,
 * written with a decimal comma. A fraction, range or number with a thousands space is answered
 * unchanged, as there is no one number to step. Down stops at one step, so that an item is never none; the amount
 * is answered unchanged then, and when it has no number to change.
 */
export function stepAmount(amount: string, direction: 1 | -1): string {
	const match = /(\d+(?:[.,]\d+)?)(\s*)(\p{L}*)/u.exec(amount);
	if (!match) return amount;
	const [whole, number, space, unit] = match;
	// Stepping only part of "1/2", "2–3" or "1 000" would give nonsense, so they are left as written.
	if (PART_OF_MORE.test(amount.slice(match.index + number.length))) return amount;
	const value = Number(number.replace(',', '.'));
	const step = stepOf(unit);
	if (direction < 0 && value <= step) return amount;
	const next = Math.round(Math.max(step, value + direction * step) * 100) / 100;
	return (
		amount.slice(0, match.index) +
		String(next).replace('.', ',') +
		space +
		unit +
		amount.slice(match.index + whole.length)
	);
}
