<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import AppHeader from '#lib/AppHeader.svelte';
	import EmptyNote from '#lib/EmptyNote.svelte';
	import FoldCard from '#lib/FoldCard.svelte';
	import { MEAL_LABELS } from '#lib/recipes.ts';
	import { WEEKDAYS, weekDates, weekName } from '#lib/weeks.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A link to a week (from a dish) opens that week; otherwise the newest is open.
	// The hash only exists in the browser.
	let target = $state('');
	onMount(() => (target = location.hash));
	const isOpen = (id: number, index: number) => (target ? target === `#vecka-${id}` : index === 0);
	// A week opened or folded by hand stays so.
	let folded = $state<Record<number, boolean>>({});

	const meals = Object.entries(MEAL_LABELS);

	type Menu = (typeof data.menus)[number];
	// Undated weeks are told apart by their first dishes.
	const subtitle = (menu: Menu) =>
		menu.weekStart
			? weekDates(menu.weekStart)
			: menu.items
					.filter((item) => item.recipeId)
					.slice(0, 3)
					.map((item) => item.text)
					.join(', ');
</script>

<svelte:head>
	<title>Veckor – Veckans mat</title>
</svelte:head>

<AppHeader title="Veckor" subtitle="{data.menus.length} veckor" />

<main>
	{#if data.menus.length === 0}
		<EmptyNote>Inga veckor än. När ni har planerat en vecka hamnar den här.</EmptyNote>
	{:else}
		{#each data.menus as menu, i (menu.id)}
			<div id="vecka-{menu.id}" class="week">
				<FoldCard
					title={weekName(menu.weekStart)}
					note={subtitle(menu)}
					bind:open={
						() => folded[menu.id] ?? isOpen(menu.id, i), (open) => (folded[menu.id] = open)
					}
				>
					<div class="body">
						{#each meals as [meal, label] (meal)}
							<!-- A week planned in the app keeps its lines in the order they were written. -->
							{@const items = menu.items
								.filter((item) => item.meal === meal)
								.toSorted((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0))}
							{#if items.length}
								<h3>{label}</h3>
								<ul>
									{#each items as item, j (j)}
										<li>
											<span class="day">{item.weekday ? WEEKDAYS[item.weekday - 1] : ''}</span>
											{#if item.recipeId}
												<a href={resolve('/ratter/[id]', { id: String(item.recipeId) })}
													>{item.text}</a
												>
											{:else}
												<span class="other">{item.text}</span>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						{/each}
					</div>
				</FoldCard>
			</div>
		{/each}
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--kh-space-l);
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	/* A link to a week lands with the week under the header. */
	.week {
		scroll-margin-top: 5rem;
	}

	.body {
		padding: 0 var(--kh-space-m) var(--kh-space-s);
	}

	h3 {
		margin: var(--kh-space-s) 0 0.125rem;
		font: var(--kh-type-caption);
		letter-spacing: var(--kh-tracking-caption);
		text-transform: uppercase;
		color: var(--kh-primary);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		gap: var(--kh-space-m);
		font: var(--kh-type-body);
	}

	.day {
		width: 2rem;
		flex-shrink: 0;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	a {
		color: inherit;
		text-decoration: none;
		flex-grow: 1;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}

	.other {
		font-style: italic;
		color: var(--kh-on-surface-variant);
	}
</style>
