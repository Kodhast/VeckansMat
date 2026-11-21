import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// web-ui has no default for a colour, so one the theme leaves out shows as nothing (#174). These are
// the colours its README says the app sets.
const REQUIRED = [
	'primary',
	'on-primary',
	'primary-container',
	'on-primary-container',
	'secondary',
	'on-secondary',
	'secondary-container',
	'on-secondary-container',
	'tertiary',
	'on-tertiary',
	'background',
	'on-background',
	'on-surface',
	'surface-variant',
	'on-surface-variant',
	'outline',
	'outline-variant',
	'error',
	'on-error',
	'error-container',
	'on-error-container',
	'inverse-surface',
	'inverse-on-surface',
	'inverse-primary',
	'card',
	'row-tint',
	'toolbar',
	'on-toolbar',
	'depth-highlight',
	'depth-sheen',
	'depth-shadow',
	'depth-card-edge',
	'depth-card-shadow'
].map((name) => `--kh-${name}`);

const css = readFileSync(new URL('./tema.css', import.meta.url), 'utf8');
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const light = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));

const declared = (block: string) =>
	new Set([...block.matchAll(/(--kh-[a-z-]+)\s*:/g)].map(([, name]) => name));

describe('the theme', () => {
	it('sets every colour web-ui needs in light mode', () => {
		const names = declared(light);
		expect(REQUIRED.filter((name) => !names.has(name))).toEqual([]);
	});

	it('sets every colour web-ui needs again in dark mode', () => {
		const names = declared(dark);
		expect(REQUIRED.filter((name) => !names.has(name))).toEqual([]);
	});

	it('is Saffran, in both modes', () => {
		expect(light).toMatch(/--kh-primary:\s*#7a5900;/);
		expect(dark).toMatch(/--kh-primary:\s*#f5bf48;/);
	});

	it('sets the typefaces and the screen title', () => {
		const names = declared(light);
		for (const name of ['--kh-font-body', '--kh-font-heading', '--kh-type-screen-title']) {
			expect(names).toContain(name);
		}
	});
});
