<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/Avatar.svelte';
	import Icon from '#lib/Icon.svelte';
	import Initial from '#lib/Initial.svelte';
	import OffersSheet from '#lib/OffersSheet.svelte';
	import StorePicker from '#lib/StorePicker.svelte';
	import { postAction } from '#lib/actions.ts';
	import { LUNCHBOX_EXTRA_CHOICES, MAX_NEW_DISHES, MAX_REPEAT_WEEKS } from '#lib/household.ts';
	import {
		chainLabel,
		fetchedText,
		hasStores,
		type Chain,
		type ChainState,
		type StoreChoice
	} from '#lib/offers.ts';
	import { weeksText } from '#lib/weeks.ts';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	// Shown at once when tapped, and saved right after.
	let newDishes = $derived(data.settings.newDishesPerWeek);
	let lunchboxExtra = $derived(data.settings.lunchboxExtraPortions);
	let repeatWeeks = $derived(data.settings.repeatWeeks);
	let favouriteRepeatWeeks = $derived(data.settings.favouriteRepeatWeeks);

	let settingsForm: HTMLFormElement;
	let changed: string[] = [];

	// Only the fields that changed are sent, so two quick saves never undo each other. The page
	// keeps what is shown, without loading again, so nothing on it moves.
	const sendChanged: SubmitFunction = ({ formData }) => {
		for (const key of [...formData.keys()]) if (!changed.includes(key)) formData.delete(key);
		// Two taps in the same moment are sent together, with what each changed.
		changed = [];
		return async ({ update }) => update({ reset: false, invalidateAll: false });
	};

	async function save(...fields: string[]) {
		changed = [...changed, ...fields];
		await tick();
		settingsForm.requestSubmit();
	}

	// The chains change at once when tapped. Fetching their offers takes a few seconds, shown
	// on the chain, and the chain's row is then replaced with what the server answers.
	let chains = $derived(data.chains);
	let memberPrices = $derived(data.settings.memberPrices);
	let fetching = $state<Chain[]>([]);
	let showingOffers = $state(false);
	let picking = $state<Chain | null>(null);
	let pickerOpen = $state(false);
	let chainError = $state<string | null>(null);

	let shown = $derived(chains.filter((c) => c.enabled && c.fetchedAt));
	let latest = $derived(
		shown
			.map((c) => c.fetchedAt!)
			.sort()
			.at(-1)
	);
	let offerCount = $derived(shown.reduce((sum, c) => sum + c.offers, 0));

	function update(chain: Chain, change: Partial<ChainState>) {
		chains = chains.map((c) => (c.chain === chain ? { ...c, ...change } : c));
	}

	// Each chain's latest change, so an answer to an earlier one never overwrites it.
	const sent: Partial<Record<Chain, number>> = {};

	/** Saves a change to the chain, or puts back how it was when the save fails. */
	async function send(
		before: ChainState,
		action: 'chain' | 'store',
		fields: Record<string, string>
	) {
		const { chain } = before;
		const id = (sent[chain] = (sent[chain] ?? 0) + 1);
		fetching = [...fetching, chain];
		const result = await postAction(action, { chain, ...fields });
		if (sent[chain] !== id) return;
		fetching = fetching.filter((c) => c !== chain);
		if (result?.type === 'success' && result.data?.chain) {
			update(chain, result.data.chain as ChainState);
			chainError = null;
		} else {
			update(chain, before);
			chainError = 'Det gick inte att spara. Försök igen.';
		}
	}

	function toggle(chain: ChainState, enabled: boolean) {
		update(chain.chain, { enabled });
		// A chain without a store is saved when the store is chosen.
		if (enabled && hasStores(chain.chain) && !chain.storeId) choose(chain.chain);
		else send(chain, 'chain', { enabled: String(enabled) });
	}

	function choose(chain: Chain) {
		picking = chain;
		pickerOpen = true;
	}

	function pick(store: StoreChoice) {
		const before = chains.find((c) => c.chain === picking)!;
		pickerOpen = false;
		update(before.chain, { enabled: true, storeId: store.id, storeName: store.name, error: null });
		send(before, 'store', { id: store.id, name: store.name });
		picking = null;
	}

	/** Closed without a store, a chain that had none is off again, as it is saved. */
	function closePicker() {
		const chain = chains.find((c) => c.chain === picking);
		if (chain && !chain.storeId) update(chain.chain, { enabled: false });
		pickerOpen = false;
		picking = null;
	}

	async function toggleMemberPrices(on: boolean) {
		memberPrices = on;
		const result = await postAction('settings', { memberPrices: String(on) });
		if (result?.type === 'success') chainError = null;
		else {
			memberPrices = !on;
			chainError = 'Det gick inte att spara. Försök igen.';
		}
	}
</script>

<svelte:head>
	<title>Inställningar – Veckans mat</title>
</svelte:head>

<header class="kh-topbar">
	<a class="kh-icon-btn kh-icon-btn--tonal" href={resolve('/')} aria-label="Tillbaka">
		<Icon name="back" />
	</a>
	<h1 class="kh-topbar__title"><kh-dots></kh-dots><span>Inställningar</span></h1>
</header>

<main>
	{#if data.account}
		{@const { name, email } = data.account}
		<section class="kh-card account" aria-label="Konto">
			<Avatar large />
			{#if name}<strong>{name}</strong>{/if}
			<span class="supporting">{email}</span>
			<span class="supporting">Inloggad med Google</span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- Access logs out, not the app, so the app is left in full -->
			<a
				class="kh-btn kh-btn--outlined kh-btn--compact"
				href="/cdn-cgi/access/logout"
				data-sveltekit-reload>Logga ut</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</section>
	{/if}

	<h2>Personer</h2>
	{#if data.people.length === 0}
		<p class="note">Inga personer än. Lägg till de som brukar äta, med det de inte äter.</p>
	{:else}
		<section class="kh-card rows" aria-label="Personer">
			{#each data.people as person, i (person.id)}
				<a class="kh-row" href={resolve('/installningar/[id]', { id: String(person.id) })}>
					<span class="kh-row__leading"><Initial name={person.name} index={i} /></span>
					<span class="kh-row__text">
						<span class="kh-row__title">{person.name}</span>
						<span class="kh-row__subtitle">{person.requirements.split('\n')[0] || 'Inga krav'}</span
						>
					</span>
					<span class="kh-chevron"></span>
				</a>
			{/each}
		</section>
	{/if}
	<a class="kh-btn kh-btn--secondary add" href={resolve('/installningar/[id]', { id: 'ny' })}>
		<Icon name="add" />Lägg till person
	</a>

	<h2>Regler för varje vecka</h2>
	<form method="POST" action="?/settings" use:enhance={sendChanged} bind:this={settingsForm}>
		<label class="kh-field">
			<textarea
				class="kh-field__input"
				id="menuRules"
				name="menuRules"
				rows="4"
				placeholder=" "
				value={data.settings.menuRules}
				onchange={() => save('menuRules')}></textarea>
			<span class="kh-field__label">Skriv som till en person, en regel per rad</span>
		</label>

		{#snippet stepper(
			label: string,
			value: number,
			min: number,
			max: number,
			set: (n: number) => void
		)}
			<kh-stepper
				{value}
				{min}
				{max}
				{label}
				onchange={(e: Event & { currentTarget: HTMLElement & { value: number } }) =>
					set(e.currentTarget.value)}
			></kh-stepper>
		{/snippet}

		<section class="kh-card rows">
			<div class="kh-row">
				<span class="kh-row__text"><span class="kh-row__title">Nya rätter per vecka</span></span>
				{@render stepper('nya rätter per vecka', newDishes, 0, MAX_NEW_DISHES, (n) => {
					newDishes = n;
					save('newDishesPerWeek');
				})}
				<input type="hidden" name="newDishesPerWeek" value={newDishes} />
			</div>

			<div class="kh-row lunchbox">
				<span class="kh-row__text"
					><span class="kh-row__title" id="lunchbox">Extra portioner till matlådor</span></span
				>
				<div class="kh-segmented" role="group" aria-labelledby="lunchbox">
					{#each LUNCHBOX_EXTRA_CHOICES as n (n)}
						<button
							type="button"
							aria-pressed={lunchboxExtra === n}
							aria-label={n === 1 ? '1 extra portion' : `${n} extra portioner`}
							onclick={() => {
								lunchboxExtra = n;
								save('lunchboxExtraPortions');
							}}>{n}</button
						>
					{/each}
				</div>
				<input type="hidden" name="lunchboxExtraPortions" value={lunchboxExtra} />
			</div>
		</section>

		<h2>Hur ofta samma rätt</h2>
		<section class="kh-card rows">
			<div class="kh-row">
				<span class="kh-row__text">
					<span class="kh-row__title">Vanliga rätter</span>
					<span class="kh-row__subtitle">tidigast efter {weeksText(repeatWeeks)}</span>
				</span>
				{@render stepper('veckor för vanliga rätter', repeatWeeks, 1, MAX_REPEAT_WEEKS, (n) => {
					repeatWeeks = n;
					// A favourite never waits longer than other dishes.
					if (favouriteRepeatWeeks <= n) save('repeatWeeks');
					else {
						favouriteRepeatWeeks = n;
						save('repeatWeeks', 'favouriteRepeatWeeks');
					}
				})}
				<input type="hidden" name="repeatWeeks" value={repeatWeeks} />
			</div>

			<div class="kh-row">
				<span class="kh-row__text">
					<span class="kh-row__title favourite"><Icon name="thumbUp" />Favoriter</span>
					<span class="kh-row__subtitle">tidigast efter {weeksText(favouriteRepeatWeeks)}</span>
				</span>
				{@render stepper('veckor för favoriter', favouriteRepeatWeeks, 1, repeatWeeks, (n) => {
					favouriteRepeatWeeks = n;
					save('favouriteRepeatWeeks');
				})}
				<input type="hidden" name="favouriteRepeatWeeks" value={favouriteRepeatWeeks} />
			</div>
		</section>

		{#if form?.error}
			<p class="error-text" role="alert">{form.error}</p>
		{/if}
		<p class="note">
			Sparas direkt. Gäller varje vecka, tillsammans med kraven för de som äter. Åts en rätt vecka
			40 och det står 4 veckor, föreslår Claude den tidigast vecka 44. Favoriter väljer du på
			rättens sida. Det du skriver in själv bestämmer du alltid.
		</p>
	</form>

	<h2>Erbjudanden</h2>
	<p class="note">
		Claude väljer gärna rätter med det som är på extrapris i de butiker ni handlar i. Slå på de
		kedjor ni brukar handla hos.
	</p>
	<div class="kh-card rows">
		{#each chains as chain (chain.chain)}
			{@const label = chainLabel(chain.chain)}
			<section class="chain" aria-label={label}>
				<label class="kh-row kh-switch-row">
					<span class="kh-row__text"><span class="kh-row__title">{label}</span></span>
					<input
						type="checkbox"
						role="switch"
						class="kh-switch"
						checked={chain.enabled}
						onchange={(e) => toggle(chain, e.currentTarget.checked)}
					/>
				</label>
				{#if chain.enabled}
					{#if hasStores(chain.chain)}
						<div class="kh-row store">
							<span class="kh-row__text">
								<span class="kh-row__subtitle">{chain.storeName ?? 'Ingen butik vald'}</span>
							</span>
							<button
								type="button"
								class="kh-btn kh-btn--text kh-btn--compact"
								onclick={() => choose(chain.chain)}
							>
								{chain.storeId ? 'Byt butik' : 'Välj butik'}
							</button>
						</div>
					{:else}
						<p class="supporting">Samma erbjudanden i alla butiker</p>
					{/if}
					{#if fetching.includes(chain.chain)}
						<p class="supporting" role="status">Hämtar erbjudanden …</p>
					{:else if chain.error}
						<p class="error-text">Kunde inte hämta senast. {chain.error}</p>
					{/if}
				{/if}
			</section>
		{/each}

		<label class="kh-row kh-switch-row">
			<span class="kh-row__text">
				<span class="kh-row__title">Räkna med medlemspriser</span>
				<span class="kh-row__subtitle">Stammis, Willys Plus, Coop-medlem och Lidl Plus</span>
			</span>
			<input
				type="checkbox"
				role="switch"
				class="kh-switch"
				checked={memberPrices}
				onchange={(e) => toggleMemberPrices(e.currentTarget.checked)}
			/>
		</label>
	</div>

	{#if chainError}
		<p class="error-text" role="alert">{chainError}</p>
	{/if}
	<p class="note">
		Sparas direkt. Erbjudandena hämtas varje måndag morgon och när du byter butik.
		{#if latest}Senast {fetchedText(latest)}: {offerCount} erbjudanden.{/if}
	</p>
	{#if offerCount}
		<button
			type="button"
			class="kh-btn kh-btn--secondary show-offers"
			onclick={() => (showingOffers = true)}
		>
			<Icon name="tag" />Visa veckans erbjudanden
		</button>
	{/if}
</main>

<OffersSheet open={showingOffers} onclose={() => (showingOffers = false)} />

<StorePicker
	chain={picking}
	open={pickerOpen}
	chosen={chains.find((c) => c.chain === picking)?.storeId ?? null}
	onpick={pick}
	onclose={closePicker}
/>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--kh-space-s) var(--kh-space-l) var(--kh-space-l);
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	h2 {
		margin: var(--kh-space-m) 0 0 var(--kh-space-xs);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	.account {
		align-items: center;
		text-align: center;
		gap: var(--kh-space-xs);
	}

	.account :global(.large) {
		margin-bottom: var(--kh-space-s);
	}

	.account strong {
		font: var(--kh-type-section-title);
	}

	.account .kh-btn {
		margin-top: var(--kh-space-m);
	}

	/* The rows go almost to the card's edge, as in android-ui's settings. */
	.rows {
		padding: var(--kh-space-xs);
		gap: 0;
	}

	.add,
	.show-offers {
		align-self: flex-start;
	}

	/* The two choices beside the text, as the steppers. */
	.lunchbox .kh-segmented {
		flex: none;
		inline-size: 7.5rem;
	}

	textarea {
		min-block-size: 6rem;
	}

	.supporting {
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	.favourite {
		display: flex;
		align-items: center;
		gap: var(--kh-space-s);
	}

	.favourite :global(svg) {
		width: 1rem;
		height: 1rem;
		color: var(--kh-primary);
	}

	/* What a chain says under its switch stands in from the row's edge. */
	.chain p {
		margin: 0;
		padding: 0 var(--kh-space-m) var(--kh-space-s);
	}

	.store {
		min-block-size: 0;
		padding-block: 0;
	}
</style>
