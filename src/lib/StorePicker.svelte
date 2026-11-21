<script lang="ts">
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { chainLabel, type Chain, type StoreChoice } from './offers.ts';

	// Finds a chain's store by town or name, through the app's server, and chooses it.
	let {
		chain,
		open,
		chosen,
		onpick,
		onclose
	}: {
		/** The chain whose stores are searched, until the sheet has closed. */
		chain: Chain | null;
		open: boolean;
		/** The store chosen now, shown as chosen when it is found. */
		chosen: string | null;
		onpick: (store: StoreChoice) => void;
		onclose: () => void;
	} = $props();

	let query = $state('');
	let stores = $state<StoreChoice[] | null>(null);
	let searching = $state(false);
	let failed = $state<string | null>(null);
	// Asks once the typing stops, so the chain is asked once per search and not per letter.
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Only the latest search's answer is shown.
	let latest = 0;

	// Each opening starts with an empty search, and a search from before is let go.
	$effect.pre(() => {
		if (!open) return;
		clearTimeout(timer);
		latest++;
		query = '';
		stores = null;
		failed = null;
		searching = false;
	});
	let input: HTMLInputElement | undefined = $state();
	function clear() {
		clearTimeout(timer);
		latest++;
		query = '';
		stores = null;
		failed = null;
		searching = false;
		input?.focus();
	}

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(search, 700);
	}

	async function search() {
		clearTimeout(timer);
		const text = query.trim();
		if (!chain || text.length < 2) return;
		const asked = ++latest;
		searching = true;
		failed = null;
		try {
			const response = await fetch(
				`/installningar/butiker?kedja=${chain}&q=${encodeURIComponent(text)}`
			);
			// An error page that is not JSON reads as no answer.
			const answer = (await response.json().catch(() => null)) as
				StoreChoice[] | { error?: string } | null;
			if (asked !== latest) return;
			if (Array.isArray(answer)) stores = answer;
			else failed = answer?.error ?? `Kunde inte söka hos ${chainLabel(chain)}. Försök igen.`;
		} catch {
			if (asked === latest) failed = 'Kunde inte söka. Är telefonen uppkopplad?';
		}
		if (asked === latest) searching = false;
	}
</script>

<Sheet {open} title={chain ? `Välj ${chainLabel(chain)}-butik` : ''} full {onclose}>
	{#if chain}
		<div class="body">
			<label class="kh-field">
				<input
					class="kh-field__input"
					type="search"
					autocomplete="off"
					enterkeyhint="search"
					placeholder=" "
					aria-label="Sök på ort eller butik"
					bind:value={query}
					bind:this={input}
					{oninput}
					onkeydown={(e) => e.key === 'Enter' && search()}
				/>
				<span class="kh-field__label">Sök på ort eller butik</span>
				{#if query}
					<button type="button" class="kh-icon-btn" aria-label="Rensa" onclick={clear}>
						<Icon name="close" />
					</button>
				{:else}
					<Icon name="search" />
				{/if}
			</label>
			{#if searching}
				<div class="kh-loading" role="status" aria-label="Söker"><kh-dots bouncing></kh-dots></div>
			{:else if failed}
				<p class="error-text" role="alert">{failed}</p>
			{:else if stores?.length === 0}
				<p>Inga butiker hittades. Sök på orten där butiken ligger.</p>
			{/if}
			{#if stores && !searching}
				<ul>
					{#each stores as store (store.id)}
						<li>
							<button
								type="button"
								class="kh-row"
								aria-pressed={store.id === chosen}
								onclick={() => onpick(store)}
							>
								<span class="kh-row__leading"><span class="dot" aria-hidden="true"></span></span>
								<span class="kh-row__text">
									<span class="kh-row__title">{store.name}</span>
									{#if store.place}<span class="kh-row__subtitle">{store.place}</span>{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<p>Butiken sparas bara här i appen. Erbjudandena hämtas direkt när du valt.</p>
		</div>
	{/if}
</Sheet>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
		padding-bottom: var(--kh-space-l);
	}

	p {
		margin: 0 var(--kh-space-xs);
		font: var(--kh-type-body-medium);
		color: var(--kh-on-surface-variant);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-xs);
	}

	/* The chosen store's row is tinted, with its radio dot filled. */
	.kh-row[aria-pressed='true'] {
		background-color: var(--kh-secondary-container);
	}

	.dot {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		border: 2px solid var(--kh-on-surface-variant);
		box-sizing: border-box;
	}

	[aria-pressed='true'] .dot {
		border-color: var(--kh-primary);
		background: radial-gradient(var(--kh-primary) 45%, transparent 50%);
	}
</style>
