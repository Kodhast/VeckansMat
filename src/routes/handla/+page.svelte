<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Fields } from '#lib/actions.ts';
	import { Answers } from '#lib/answers.svelte.ts';
	import AddItemSheet from '#lib/AddItemSheet.svelte';
	import AmountSheet from '#lib/AmountSheet.svelte';
	import { useToolbarAction } from '#lib/toolbar.svelte.ts';
	import FoldCard from '#lib/FoldCard.svelte';
	import Icon from '#lib/Icon.svelte';
	import ShoppingRow from '#lib/ShoppingRow.svelte';
	import Snackbar from '#lib/Snackbar.svelte';
	import WeekHeader from '#lib/WeekHeader.svelte';
	import type { RemovedItem, ShoppingItem } from '#lib/server/db/shopping.ts';
	import { cleanText, plural } from '#lib/names.ts';
	import { BASKET_LOOK, HAND_LOOK, lookOf, sectionRank, type Look } from '#lib/shopping.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The list as the latest change answered with it, per week.
	const answers = new Answers<ShoppingItem[]>((answer, fields) =>
		answer.items ? [String(fields.weekStart), answer.items as ShoppingItem[]] : null
	);
	$effect.pre(() => {
		void data;
		answers.clear();
	});
	let items = $derived(answers.of(data.weekStart) ?? data.items);

	// A tap shows at once, before the server has answered.
	let pendingChecked = $state<Record<number, boolean>>({});
	// Items written in but not yet saved, per week.
	let adding = $state<Record<string, string[]>>({});
	let addOpen = $state(false);
	useToolbarAction({ label: 'Lägg till en vara', onclick: () => (addOpen = true) });
	// Per week, so that the other week shows its own list meanwhile.
	let makingWeeks = $state<Record<string, boolean>>({});
	let making = $derived(!!makingWeeks[data.weekStart]);
	// The latest item put in the basket, or removed, which the snackbar can undo.
	let basketed = $state<ShoppingItem | null>(null);
	let removed = $state<RemovedItem | null>(null);
	// The item whose amount is being changed, and amounts saved but not yet answered.
	let amountOf = $state<ShoppingItem | null>(null);
	type Amount = Pick<ShoppingItem, 'amount' | 'amountEdited' | 'amountBefore'>;
	let pendingAmounts = $state<Record<number, Amount & { change: number }>>({});
	let amountChanges = 0;
	// Items swiped away, hidden until the server has answered.
	let removing = $state<Record<number, boolean>>({});
	// Why Claude made no list, per week; then the list is the recipes' lines.
	let listErrors = $state<Record<string, 'failed' | 'limit'>>({});
	// Per week, the week as it was when the household chose not to update the list; a later
	// change to the week asks again.
	let notNow = $state<Record<string, string>>({});
	let listError = $derived(listErrors[data.weekStart]);

	const isChecked = (item: ShoppingItem) => pendingChecked[item.id] ?? item.checked;
	let shown = $derived(
		items
			.filter((item) => !removing[item.id])
			.map((item) => {
				const pending = pendingAmounts[item.id];
				return pending
					? {
							...item,
							amount: pending.amount,
							amountEdited: pending.amountEdited,
							amountBefore: pending.amountBefore
						}
					: item;
			})
	);
	let toBuy = $derived(shown.filter((item) => !isChecked(item)));
	let basket = $derived(shown.filter(isChecked));
	let added = $derived(adding[data.weekStart] ?? []);

	// Written by hand first, under the field they are written in, then the store's sections in
	// their order; a list of the recipes' lines has a heading per dish.
	const BY_HAND = 'Skrivet själv';
	const rank = (item: ShoppingItem) => (item.origin === 'hand' ? -1 : sectionRank(item.section));
	let groups = $derived(
		Map.groupBy(
			toBuy.toSorted((a, b) => rank(a) - rank(b)),
			(item) => (item.origin === 'hand' ? BY_HAND : (item.section ?? ''))
		)
	);
	const looks: Record<string, Look> = { [BY_HAND]: HAND_LOOK };
	const dishesOf = (item: ShoppingItem) =>
		item.dishes.map((dish) => dish.name).join(', ') +
		(item.dishes.some((dish) => dish.guessed) ? ' · gissat' : '');

	// What the popup says about an amount changed by hand.
	function noteOf(item: ShoppingItem): string {
		if (!item.amountEdited) return '';
		const before = item.amountBefore ?? 'ingen mängd';
		return item.origin === 'claude'
			? `Ändrad för hand. Claude räknade ${before}.`
			: `Ändrad för hand. Först ${before}.`;
	}

	// The cards folded away, which each phone remembers. The basket starts folded.
	const BASKET = 'I korgen';
	const FOLDED_KEY = 'handla-stangda';
	let folded = $state<Record<string, boolean>>({ [BASKET]: true });
	$effect(() => {
		try {
			const stored = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? 'null');
			if (stored && typeof stored === 'object') folded = stored;
		} catch {
			// Nothing remembered, or no storage.
		}
	});
	function fold(title: string, open: boolean) {
		folded[title] = !open;
		try {
			localStorage.setItem(FOLDED_KEY, JSON.stringify(folded));
		} catch {
			// Remembered for this visit only.
		}
	}

	// How far the shopping has come, as a wavy line that grows over a straight one.
	let progress = $derived(
		toBuy.length + basket.length ? basket.length / (toBuy.length + basket.length) : 0
	);
	const WAVE_WIDTH = 154;
	let wave = $derived.by(() => {
		const end = 3 + Math.round((WAVE_WIDTH * progress) / 6) * 6;
		let d = 'M3 4';
		for (let x = 3; x < end; x += 6) d += ' q1.5 -3 3 0 t3 0';
		return { d: end > 3 ? d : '', track: `M${end > 3 ? end + 4 : 3} 4 H157` };
	});

	let onlyName = $derived(data.dishes.filter((dish) => !dish.hasIngredients));
	let isEmpty = $derived(items.length === 0 && added.length === 0);

	const post = (action: string, fields: Fields) =>
		answers.post(action, { weekStart: data.weekStart, ...fields });

	async function make() {
		const weekStart = data.weekStart;
		makingWeeks[weekStart] = true;
		delete listErrors[weekStart];
		const result = await post('make', {});
		if (result?.type === 'failure') {
			listErrors[weekStart] = result.data?.shoppingError as 'failed' | 'limit';
		}
		// A new list changes the whole page, so it loads again.
		await invalidateAll();
		delete makingWeeks[weekStart];
	}

	async function add(text: string) {
		const weekStart = data.weekStart;
		adding[weekStart] = [...(adding[weekStart] ?? []), text];
		await post('add', { text });
		adding[weekStart] = adding[weekStart].toSpliced(adding[weekStart].indexOf(text), 1);
	}

	async function check(item: ShoppingItem, checked: boolean) {
		pendingChecked[item.id] = checked;
		removed = null;
		if (checked) basketed = item;
		else if (basketed?.id === item.id) basketed = null;
		await post('check', { id: item.id, checked: String(checked) });
		// A newer tap on the same item stays until its own answer comes.
		if (pendingChecked[item.id] === checked) delete pendingChecked[item.id];
	}

	// Shown at once as it will be saved, until the server answers with the list. A newer change to
	// the same item stays until its own answer comes.
	async function changeAmount(item: ShoppingItem, amount: Amount, action: string, fields: Fields) {
		const change = ++amountChanges;
		pendingAmounts[item.id] = { ...amount, change };
		await post(action, { id: item.id, ...fields });
		if (pendingAmounts[item.id]?.change === change) delete pendingAmounts[item.id];
	}

	function saveAmount(text: string) {
		const item = amountOf;
		amountOf = null;
		if (!item) return;
		const clean = cleanText(text);
		if (clean === (item.amount ?? '')) return;
		const before = item.amountEdited ? item.amountBefore : item.amount;
		const edited = item.origin !== 'hand' && clean !== (before ?? '');
		const amount = {
			amount: clean || null,
			amountEdited: edited,
			amountBefore: edited ? before : null
		};
		changeAmount(item, amount, 'amount', { amount: clean });
	}

	function resetAmount() {
		const item = amountOf;
		amountOf = null;
		if (!item) return;
		changeAmount(
			item,
			{ amount: item.amountBefore, amountEdited: false, amountBefore: null },
			'resetAmount',
			{}
		);
	}

	async function remove(item: ShoppingItem) {
		removing[item.id] = true;
		basketed = null;
		const result = await post('remove', { id: item.id });
		delete removing[item.id];
		if (result?.type === 'success' && result.data?.removed) {
			removed = result.data.removed as RemovedItem;
		}
	}

	function undoRemove(actionTaken: boolean) {
		if (!removed) return;
		const item = removed;
		removed = null;
		if (actionTaken) post('restore', { item: JSON.stringify(item) });
	}

	function undoCheck(actionTaken: boolean) {
		if (!basketed) return;
		const item = basketed;
		basketed = null;
		if (actionTaken) check(item, false);
	}
</script>

<svelte:head>
	<title>Handla – Veckans mat</title>
</svelte:head>

{#snippet row(item: ShoppingItem)}
	<ShoppingRow
		text={item.text}
		amount={item.amount}
		amountEdited={item.amountEdited}
		note={noteOf(item)}
		dishes={item.dishes.length ? dishesOf(item) : ''}
		checked={isChecked(item)}
		oncheck={(checked) => check(item, checked)}
		onamount={() => (amountOf = item)}
		onremove={() => remove(item)}
	/>
{/snippet}

<WeekHeader
	title="Handla"
	weekStart={data.weekStart}
	thisWeek={data.thisWeek}
	nextWeek={data.nextWeek}
>
	{#snippet actions()}
		{#if !isEmpty}
			<button
				type="button"
				class="kh-icon-btn"
				aria-label="Gör om listan från veckan"
				disabled={making}
				onclick={make}
			>
				<Icon name="refresh" />
			</button>
		{/if}
	{/snippet}
</WeekHeader>

<main class="page">
	{#if toBuy.length || basket.length}
		<div class="progress">
			<svg
				role="img"
				aria-label="{basket.length} av {toBuy.length + basket.length} i korgen"
				width="160"
				height="8"
				viewBox="0 0 160 8"
			>
				{#if wave.d}<path class="wave" d={wave.d} />{/if}
				<path class="track" d={wave.track} />
			</svg>
			<span>{toBuy.length} kvar · {basket.length} i korgen</span>
		</div>
	{/if}

	{#if answers.failed}
		<p class="error" role="alert">Det gick inte att spara. Kontrollera nätet och försök igen.</p>
	{/if}

	{#if making}
		<!-- No notice while the list is being made. -->
	{:else if listError}
		<section class="kh-card notice">
			<p>
				{listError === 'limit'
					? 'Appen har använt Claude så mycket som månadens tak tillåter'
					: 'Claude kunde inte göra listan just nu'}, så här står ingredienserna rätt för rätt som
				de står i recepten.
			</p>
			<button type="button" class="kh-btn kh-btn--outlined kh-btn--compact" onclick={make}>
				Försök igen
			</button>
		</section>
	{:else if data.changed && notNow[data.weekStart] !== data.basis}
		<section class="kh-card kh-card--tone notice changed">
			<h2>Veckan har ändrats</h2>
			<p>Det du skrivit själv och det som ligger i korgen står kvar när listan uppdateras.</p>
			<div class="buttons">
				<button type="button" class="kh-btn kh-btn--compact" onclick={make}>
					Uppdatera listan
				</button>
				<button
					type="button"
					class="kh-btn kh-btn--text kh-btn--compact"
					onclick={() => (notNow[data.weekStart] = data.basis)}
				>
					Inte nu
				</button>
			</div>
		</section>
	{/if}

	{#if making}
		<div class="kh-card making">
			<div class="kh-loading"><kh-dots bouncing></kh-dots></div>
			<p role="status">Claude gör listan …</p>
			<p class="hint">Räknar om till veckans portioner och slår ihop det som behövs.</p>
		</div>
	{:else if isEmpty}
		<section class="kh-card empty">
			{#if data.dishes.length === 0}
				<h2>Veckan har inga rätter än</h2>
				<p class="hint">Skriv in veckan först, så blir listan av rätternas ingredienser.</p>
				<a href="{resolve('/')}?vecka={data.weekStart}">Till veckan</a>
			{:else}
				<h2>Ingen inköpslista för veckan än</h2>
				<p class="hint">
					Claude läser veckans rätter, räknar om till rätt antal portioner och slår ihop det som
					behövs till en lista sorterad efter butikens avdelningar.
				</p>
				<p class="hint">
					{plural(data.dishes.length - onlyName.length, 'rätt har', 'rätter har')} ingredienser.
					{#if onlyName.length}
						{plural(onlyName.length, 'rätt har', 'rätter har')} bara namn, och Claude gissar vad som brukar
						behövas och skriver in det i rätten.
					{/if}
				</p>
				<button type="button" class="kh-btn" onclick={make}>
					<Icon name="suggest" />Gör inköpslistan
				</button>
			{/if}
		</section>
	{:else}
		{#if added.length && !groups.has(BY_HAND)}
			<FoldCard title={BY_HAND} look={HAND_LOOK}>
				<ul aria-label="Sparas">
					{#each added as text, i (i)}<li class="pending">{text}</li>{/each}
				</ul>
			</FoldCard>
		{/if}
		{#each groups as [title, items] (title)}
			<FoldCard
				{title}
				look={looks[title] ?? lookOf(title)}
				count={items.length}
				bind:open={() => !folded[title], (open) => fold(title, open)}
			>
				<ul>
					{#if title === BY_HAND}
						{#each added as text, i (i)}<li class="pending">{text}</li>{/each}
					{/if}
					{#each items as item (item.id)}
						{@render row(item)}
					{/each}
				</ul>
			</FoldCard>
		{/each}

		{#if basket.length}
			<FoldCard
				title={BASKET}
				look={BASKET_LOOK}
				count={basket.length}
				bind:open={() => !folded[BASKET], (open) => fold(BASKET, open)}
			>
				<ul>
					{#each basket as item (item.id)}
						{@render row(item)}
					{/each}
				</ul>
			</FoldCard>
		{/if}
	{/if}

	{#if onlyName.length && !isEmpty && !making}
		<p class="hint only-name">
			Bara namn, inget att lista:
			{#each onlyName as dish, i (dish.id)}<a
					href={resolve('/ratter/[id]', { id: String(dish.id) })}
				>
					{dish.name}
				</a>{i < onlyName.length - 1 ? ', ' : '.'}
			{/each}
		</p>
	{/if}
</main>

<AddItemSheet bind:open={addOpen} onadd={add} />
<AmountSheet
	item={amountOf}
	dishes={amountOf?.dishes.length ? dishesOf(amountOf) : ''}
	onsave={saveAmount}
	onreset={resetAmount}
	onclose={() => (amountOf = null)}
/>

{#key basketed}
	{#if basketed}
		<Snackbar text="{basketed.text} i korgen" action="Ångra" onclose={undoCheck} />
	{/if}
{/key}
{#key removed}
	{#if removed}
		<Snackbar text="{removed.text} togs bort" action="Ångra" onclose={undoRemove} />
	{/if}
{/key}

<style>
	.progress {
		margin: -0.5rem 0 0.25rem 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.8125rem;
		color: var(--kh-on-surface-variant);
	}

	.progress svg {
		flex-shrink: 0;
	}

	.progress path {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
	}

	.wave {
		stroke: var(--kh-primary);
	}

	.track {
		stroke: var(--kh-primary-container);
	}

	ul {
		margin: 0;
		padding: 0 0 0.25rem;
		list-style: none;
	}

	/* Where the item's text will stand once it is saved, beside where its check will be. */
	.pending {
		min-height: 56px;
		padding-left: calc(var(--kh-space-m) * 2 + 48px);
		display: flex;
		align-items: center;
		font: var(--kh-type-item-title);
		color: var(--kh-on-surface-variant);
	}

	.kh-card h2 {
		margin: 0;
		font-size: 1rem;
	}

	.empty .kh-btn,
	.empty a {
		align-self: flex-start;
	}

	a {
		color: var(--kh-primary);
		font-weight: 500;
	}

	.only-name {
		margin: 0.25rem 0.25rem 0;
	}

	.making {
		align-items: center;
		text-align: center;
	}

	.making p {
		margin: 0;
	}

	.notice {
		align-items: flex-start;
	}

	.notice p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.notice.changed {
		color: var(--kh-on-primary-container);
	}

	.notice.changed .kh-btn--text {
		color: inherit;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
	}
</style>
