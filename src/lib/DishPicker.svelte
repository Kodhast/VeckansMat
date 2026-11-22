<script lang="ts">
	import Icon from './Icon.svelte';
	import { nameKey } from './names.ts';
	import Sheet from './Sheet.svelte';
	import { byName, CATEGORIES, isDish, matching, type Category } from './recipes.ts';
	import type { RecipeSummary } from './server/db/recipes.ts';
	import { eatenText } from './weeks.ts';

	// All the dishes to choose a day's from, A to Ö, by sort and by what is written. What is not
	// a dish yet becomes one when it is chosen.
	let {
		name,
		open,
		recipes,
		onpick,
		onclose
	}: {
		/** The meal and the day, as "Middag onsdag", until the sheet has closed. */
		name: string;
		open: boolean;
		recipes: RecipeSummary[];
		onpick: (text: string) => void;
		onclose: () => void;
	} = $props();

	let query = $state('');
	let category = $state<Category | null>(null);
	// Each opening starts from all the dishes.
	$effect.pre(() => {
		if (!open) return;
		query = '';
		category = null;
	});

	const sortOf = (recipe: RecipeSummary) => recipe.category ?? 'ovrigt';
	const sortLabel = (recipe: RecipeSummary) =>
		CATEGORIES.find((c) => c.key === sortOf(recipe))!.label;
	let sorts = $derived(CATEGORIES.filter((c) => recipes.some((r) => sortOf(r) === c.key)));
	let key = $derived(nameKey(query));
	let shown = $derived(
		matching(recipes, query)
			.filter((r) => !category || sortOf(r) === category)
			.toSorted(byName)
	);
	let isNew = $derived(key && isDish(query) && !recipes.some((r) => nameKey(r.name) === key));

	// Enter chooses the dish with that name, the only one that matches, or a new one.
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || !key) return;
		event.preventDefault();
		const exact = recipes.find((r) => nameKey(r.name) === key);
		const pick = exact?.name ?? (shown.length === 1 ? shown[0].name : isNew ? query : null);
		if (pick) onpick(pick);
	}
</script>

<Sheet {open} title={name} full {onclose}>
	<!-- The dishes stay while the sheet slides away. -->
	{#if name}
		<div class="body">
			<label class="kh-field">
				<input
					class="kh-field__input"
					type="search"
					autocomplete="off"
					enterkeyhint="done"
					placeholder=" "
					aria-label="Sök eller skriv en ny rätt"
					bind:value={query}
					{onkeydown}
				/>
				<span class="kh-field__label">Sök eller skriv en ny rätt</span>
				{#if query}
					<button type="button" class="kh-icon-btn" aria-label="Rensa" onclick={() => (query = '')}>
						<Icon name="close" />
					</button>
				{:else}
					<Icon name="search" />
				{/if}
			</label>
			<div class="kh-chips" role="group" aria-label="Sort">
				{#each sorts as sort (sort.key)}
					<button
						type="button"
						class="kh-chip"
						aria-pressed={category === sort.key}
						onclick={() => (category = category === sort.key ? null : sort.key)}
					>
						{sort.label}
					</button>
				{/each}
			</div>
			<ul>
				{#each shown as recipe (recipe.id)}
					<li>
						<button type="button" onclick={() => onpick(recipe.name)}>
							<span class="name">
								{recipe.name}{#if recipe.vote === 'favorit'}<span
										class="favourite"
										role="img"
										aria-label="Favorit"
									>
										<Icon name="thumbUp" />
									</span>{/if}
							</span>
							<span class="meta">{sortLabel(recipe)} · {eatenText(recipe)}</span>
						</button>
					</li>
				{/each}
				{#if isNew}
					<li>
						<button type="button" class="new" onclick={() => onpick(query)}>
							<Icon name="add" />Ny rätt: ”{query.trim()}”
						</button>
					</li>
				{/if}
			</ul>
		</div>
	{/if}
</Sheet>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		border-top: 1px solid var(--kh-outline-variant);
	}

	/* web-ui's field has its own button to clear it. */
	input::-webkit-search-cancel-button {
		appearance: none;
	}

	li button {
		width: 100%;
		min-height: 3.5rem;
		padding: 0.375rem 0.25rem;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		display: flex;
		flex-direction: column;
		justify-content: center;
		cursor: pointer;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--kh-on-surface-variant);
	}

	.favourite {
		margin-left: 0.25rem;
		vertical-align: -0.125rem;
		color: var(--kh-primary);
	}

	.new {
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		color: var(--kh-primary);
	}
</style>
