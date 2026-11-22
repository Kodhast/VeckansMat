import type { ActionResult } from '$app/forms';
import { postAction, type Fields } from './actions';

/**
 * What the latest change answered with, per week, which a page shows until it loads again. An
 * answer to an older change than one already shown is left out, so answers that arrive out of
 * order never put back an older state. A failure stays shown until the page loads again; what an
 * action itself turns down is for its caller to show.
 */
export class Answers<T> {
	#byWeek = $state<Record<string, { value: T; change: number }>>({});
	#changes = 0;
	failed = $state(false);

	/**
	 * @param read The week and what to show from a successful answer and the fields it was sent
	 * with, or null when it has none.
	 */
	constructor(
		private read: (data: Record<string, unknown>, fields: Fields) => [string, T] | null
	) {}

	/** What the latest answer for the week was, if any since the page loaded. */
	of(weekStart: string): T | undefined {
		return this.#byWeek[weekStart]?.value;
	}

	/** Forgets the answers, as when the page has loaded again. */
	clear() {
		this.#byWeek = {};
	}

	/** Posts to one of the page's actions, and keeps what it answered. */
	async post(action: string, fields: Fields): Promise<ActionResult | null> {
		const change = ++this.#changes;
		const result = await postAction(action, fields);
		const fresh = result?.type === 'success' && result.data ? this.read(result.data, fields) : null;
		if (fresh) {
			const [weekStart, value] = fresh;
			if (change > (this.#byWeek[weekStart]?.change ?? 0))
				this.#byWeek[weekStart] = { value, change };
		}
		if (!result || result.type === 'error') this.failed = true;
		return result;
	}
}
