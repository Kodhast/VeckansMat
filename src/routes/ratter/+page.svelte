<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppHeader from '#lib/AppHeader.svelte';
	import EmptyNote from '#lib/EmptyNote.svelte';
	import FoldCard from '#lib/FoldCard.svelte';
	import Icon from '#lib/Icon.svelte';
	import Snackbar from '#lib/Snackbar.svelte';
	import { useToolbarAction } from '#lib/toolbar.svelte.ts';
	import { recipeUrl } from '#lib/links.ts';
	import { nameKey } from '#lib/names.ts';
	import { byName, byOften, CATEGORIES, categoryLook, matching } from '#lib/recipes.ts';
	import { eatenText } from '#lib/weeks.ts';
	import type { RecipeSummary } from '#lib/server/db/recipes.ts';
	import type { PageProps, SubmitFunction } from './$types';

	let { data, form }: PageProps = $props();

	useToolbarAction({ label: 'Ny rätt', href: '/ratter/ny' });

	let query = $state('');
	const orders = [
		['often', 'Oftast'],
		['name', 'A–Ö']
	] as const;
	let order = $state<(typeof orders)[number][0]>('often');

	// Dishes added here, shown at once without loading the page again.
	let added = $state<RecipeSummary[]>([]);
	$effect.pre(() => {
		void data;
		added = [];
	});
	let recipes = $derived([...data.recipes, ...added]);

	let key = $derived(nameKey(query));
	let shown = $derived(matching(recipes, query).toSorted(order === 'name' ? byName : byOften));
	// The dishes per sort, in the sorts' order. A dish Claude has not sorted yet is Övrigt.
	let groups = $derived(
		CATEGORIES.map((c) => ({
			...c,
			recipes: shown.filter((r) => (r.category ?? 'ovrigt') === c.key)
		})).filter((g) => g.recipes.length)
	);

	// The sorts folded away, which each phone remembers. All start open, since a dish just added
	// is Övrigt until Claude has sorted it.
	const FOLDED_KEY = 'ratter-stangda';
	let folded = $state<Record<string, boolean>>({});
	$effect(() => {
		try {
			const stored = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? 'null');
			if (stored && typeof stored === 'object') folded = stored;
		} catch {
			// Nothing remembered, or no storage.
		}
	});
	function fold(key: string, open: boolean) {
		folded[key] = !open;
		try {
			localStorage.setItem(FOLDED_KEY, JSON.stringify(folded));
		} catch {
			// Remembered for this visit only.
		}
	}
	let exact = $derived(key ? recipes.find((r) => nameKey(r.name) === key) : undefined);
	// A link is not a dish's name but a recipe to read.
	let link = $derived(!!recipeUrl(query, true));

	// A dish that already exists is opened instead of added again. A link is sent on, and the
	// server sends it to Nytt recept.
	const add: SubmitFunction = ({ cancel }) => {
		if (exact) {
			cancel();
			goto(resolve('/ratter/[id]', { id: String(exact.id) }));
			return;
		}
		return async ({ result, update }) => {
			await update({ invalidateAll: false });
			if (result.type === 'success' && result.data?.added) {
				const { id, name } = result.data.added as { id: number; name: string };
				added.push({
					id,
					name,
					timesEaten: 0,
					lastWeek: null,
					category: null,
					base: null,
					vote: null
				});
				query = '';
				justAdded = { id, name };
			}
		};
	};

	// The arrows move the choice, as in a group of radio buttons, and the focus goes with it.
	function step(event: KeyboardEvent & { currentTarget: HTMLElement }) {
		const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
		if (!by) return;
		event.preventDefault();
		const i = (orders.findIndex(([value]) => value === order) + by + orders.length) % orders.length;
		order = orders[i][0];
		(event.currentTarget.children[i] as HTMLElement).focus();
	}

	// The button goes when the field is empty, so the focus goes back to the field.
	let search: HTMLInputElement | undefined = $state();
	function clear() {
		query = '';
		search?.focus();
	}

	// The dish just added, which the message offers to open.
	let justAdded = $state<{ id: number; name: string } | null>(null);
	function openAdded(open: boolean) {
		const dish = justAdded;
		justAdded = null;
		if (open && dish) goto(resolve('/ratter/[id]', { id: String(dish.id) }));
	}
</script>

<svelte:head>
	<title>Rätter – Veckans mat</title>
</svelte:head>

<AppHeader title="Rätter" subtitle="{recipes.length} rätter" />

<main>
	<form method="POST" action="?/add" use:enhance={add}>
		<label class="kh-field">
			<input
				class="kh-field__input"
				name="name"
				type="search"
				autocomplete="off"
				placeholder=" "
				aria-label="Sök eller lägg till rätt"
				bind:value={query}
				bind:this={search}
			/>
			<span class="kh-field__label">Sök eller lägg till rätt</span>
			{#if query}
				<button type="button" class="kh-icon-btn" aria-label="Rensa" onclick={clear}>
					<Icon name="close" />
				</button>
			{:else}
				<Icon name="search" />
			{/if}
		</label>
		{#if link}
			<button class="kh-btn"><Icon name="link" />Hämta receptet</button>
		{:else if key && !exact}
			<button class="kh-btn"><Icon name="add" />Lägg till ”{query.trim()}”</button>
		{/if}
		{#if form?.error}
			<p class="error-text" role="alert">{form.error}</p>
		{/if}
	</form>

	{#if !key}
		<!-- svelte-ignore a11y_interactive_supports_focus (the focus is on the radio buttons) -->
		<div class="kh-segmented" role="radiogroup" aria-label="Ordning" onkeydown={step}>
			{#each orders as [value, label] (value)}
				<button
					type="button"
					role="radio"
					aria-checked={order === value}
					tabindex={order === value ? 0 : -1}
					onclick={() => (order = value)}>{label}</button
				>
			{/each}
		</div>
	{:else if shown.length > 0 && !exact && !link}
		<h2>Liknande rätter</h2>
	{/if}

	{#if recipes.length === 0}
		<EmptyNote>Inga rätter än. Skriv namnet på en rätt ovan och lägg till den.</EmptyNote>
	{:else}
		{#each groups as group (group.key)}
			<!-- While searching, every sort with a match is open, and stays so. -->
			<FoldCard
				title={group.label}
				look={categoryLook(group.key)}
				count={group.recipes.length}
				bind:open={() => !!key || !folded[group.key], (open) => key || fold(group.key, open)}
			>
				<ul>
					{#each group.recipes as recipe (recipe.id)}
						<li>
							<a class="kh-row" href={resolve('/ratter/[id]', { id: String(recipe.id) })}>
								<span class="kh-row__text">
									<span class="kh-row__title"
										>{recipe.name}{#if recipe.vote === 'favorit'}<span
												class="vote"
												role="img"
												aria-label="Favorit"><Icon name="thumbUp" /></span
											>{:else if recipe.vote === 'aldrig'}<span
												class="vote never"
												role="img"
												aria-label="Aldrig mer"><Icon name="thumbUp" /></span
											>{/if}</span
									>
									<span class="kh-row__subtitle meta">{eatenText(recipe)}</span>
								</span>
								<span class="kh-chevron"></span>
							</a>
						</li>
					{/each}
				</ul>
			</FoldCard>
		{/each}
	{/if}
</main>

{#key justAdded}
	{#if justAdded}
		<Snackbar text="{justAdded.name} är tillagd" action="Öppna" onclose={openAdded} />
	{/if}
{/key}

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	h2 {
		margin: 0.25rem 0 0 0.25rem;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	/* web-ui's field has its own button to clear it. */
	input::-webkit-search-cancel-button {
		appearance: none;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.vote {
		margin-left: 0.25rem;
		vertical-align: -0.125rem;
		color: var(--kh-primary);
	}

	.vote :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.never {
		color: var(--kh-on-surface-variant);
	}

	.never :global(svg) {
		transform: scaleY(-1);
	}

	.meta {
		font-variant-numeric: tabular-nums;
	}
</style>
