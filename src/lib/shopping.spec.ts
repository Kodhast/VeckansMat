import { describe, expect, it } from 'vitest';
import { sectionRank, stepAmount } from './shopping';

describe('the order of the list headings', () => {
	it('is the store order, with any other heading after it', () => {
		const headings = [
			'Fiskgratäng',
			'Finns kanske hemma',
			'Mejeri och ägg',
			null,
			'Frukt och grönt'
		];
		expect(headings.toSorted((a, b) => sectionRank(a) - sectionRank(b))).toEqual([
			'Frukt och grönt',
			'Mejeri och ägg',
			'Finns kanske hemma',
			'Fiskgratäng',
			null
		]);
	});
});

describe('the amount stepped by − and +', () => {
	it('steps the first number by the unit after it', () => {
		expect(stepAmount('800 g', 1)).toBe('900 g');
		expect(stepAmount('800 g', -1)).toBe('700 g');
		expect(stepAmount('400g', 1)).toBe('500g');
		expect(stepAmount('1 kg', 1)).toBe('1,5 kg');
		expect(stepAmount('1,5 l', -1)).toBe('1 l');
		expect(stepAmount('3 st', -1)).toBe('2 st');
		expect(stepAmount('2 dl', 1)).toBe('3 dl');
		expect(stepAmount('ca 2 förp. à 500 g', 1)).toBe('ca 3 förp. à 500 g');
	});

	it('reads a decimal point and writes a decimal comma', () => {
		expect(stepAmount('0.5 kg', 1)).toBe('1 kg');
		expect(stepAmount('2,5 st', 1)).toBe('3,5 st');
	});

	it('goes no lower than one step', () => {
		expect(stepAmount('1 st', -1)).toBe('1 st');
		expect(stepAmount('100 g', -1)).toBe('100 g');
		expect(stepAmount('50 g', -1)).toBe('50 g');
		expect(stepAmount('150 g', -1)).toBe('100 g');
		expect(stepAmount('0,5 kg', -1)).toBe('0,5 kg');
	});

	it('leaves an amount without a number', () => {
		expect(stepAmount('en burk', 1)).toBe('en burk');
	});

	it('leaves fractions, ranges and thousands as written, since there is no one number to step', () => {
		for (const amount of ['1/2 l', '1 1/2 dl', '1½ dl', '2-3 st', '2 – 3 st', '1 000 g']) {
			expect(stepAmount(amount, 1)).toBe(amount);
			expect(stepAmount(amount, -1)).toBe(amount);
		}
	});

	it('steps a unit written out like its short form', () => {
		expect(stepAmount('1 liter', 1)).toBe('1,5 liter');
		expect(stepAmount('2 kilo', -1)).toBe('1,5 kilo');
		expect(stepAmount('300 gram', 1)).toBe('400 gram');
		expect(stepAmount('', -1)).toBe('');
	});
});
