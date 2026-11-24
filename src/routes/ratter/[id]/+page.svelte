<script lang="ts">
	import { resolve } from '$app/paths';
	import { postAction } from '#lib/actions.ts';
	import FoldCard from '#lib/FoldCard.svelte';
	import Icon from '#lib/Icon.svelte';
	import RecipeInvite from '#lib/RecipeInvite.svelte';
	import VoteButton from '#lib/VoteButton.svelte';
	import {
		BASES,
		CATEGORIES,
		hasOnlyName,
		LUNCHBOX_TAG,
		MEAL_LABELS,
		splitSteps,
		timesText,
		type Vote
	} from '#lib/recipes.ts';
	import { weekName, weeksText } from '#lib/weeks.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let recipe = $derived(data.recipe);
	let onlyName = $derived(hasOnlyName(recipe));
	let category = $derived(CATEGORIES.find((c) => c.key === recipe.category));
	// "Annat" says nothing about the dish, so it is not shown.
	let base = $derived(
		recipe.base === 'annat' ? undefined : BASES.find((b) => b.key === recipe.base)
	);
	let lastWeek = $derived(recipe.weeks.find((w) => w.weekStart)?.weekStart ?? null);
	let eaten = $derived(
		recipe.weeks.length === 0
			? 'Inte ätit än'
			: `Ätits ${timesText(recipe.weeks.length)}` +
					(lastWeek ? `, senast ${weekName(lastWeek).toLocaleLowerCase('sv')}` : '')
	);
	let facts = $derived([
		...(recipe.servings ? [`${recipe.servings} portioner`] : []),
		...(recipe.timeMinutes ? [`${recipe.timeMinutes} min`] : []),
		...recipe.tags.map((tag) => (tag === LUNCHBOX_TAG ? 'Passar till matlådor' : tag))
	]);
	let steps = $derived(splitSteps(recipe.instructions));

	// The vote as just tapped, saved in the background (ADR 0016).
	let voted = $state<Vote | null>(null);
	let voteFailed = $state(false);
	$effect.pre(() => {
		void data;
		voted = null;
	});
	let vote = $derived(voted ?? recipe.vote);

	// One vote is sent at a time, so the last tap is the one saved.
	let sending: Promise<unknown> = Promise.resolve();

	function setVote(value: Vote) {
		voted = value;
		sending = sending.then(async () => {
			const result = await postAction('vote', { vote: value });
			voteFailed = result?.type !== 'success';
			// What failed shows as it was saved, unless a newer tap is on its way.
			if (voteFailed && voted === value) voted = null;
		});
	}
</script>

<svelte:head>
	<title>{recipe.name} – Veckans mat</title>
</svelte:head>

<header class="kh-topbar">
	<a
		class="kh-icon-btn kh-icon-btn--tonal"
		href={resolve('/ratter')}
		aria-label="Tillbaka till rätter"
	>
		<Icon name="back" />
	</a>
	<h1 class="kh-topbar__title"><kh-dots></kh-dots><span>{recipe.name}</span></h1>
	<div class="kh-topbar__actions">
		<a
			class="kh-icon-btn"
			href={resolve('/ratter/[id]/redigera', { id: String(recipe.id) })}
			aria-label="Redigera"
		>
			<Icon name="edit" />
		</a>
	</div>
</header>

<main class="kh-page">
	<section class="kh-card">
		{#if category || base || facts.length || vote === 'favorit'}
			<ul class="kh-pills">
				{#if category}
					<li
						class="kh-pill"
						style:--kh-tone-container={category.tint}
						style:--kh-tone-content={category.ink}
					>
						<Icon name={category.key} />{category.label}
					</li>
				{/if}
				{#if base}<li class="kh-pill">{base.label}</li>{/if}
				{#if vote === 'favorit'}
					<li class="kh-pill">
						<Icon name="thumbUp" />Favorit · får komma efter {weeksText(data.favouriteWeeks)}
					</li>
				{/if}
				{#each facts as fact, i (i)}<li class="kh-pill">{fact}</li>{/each}
			</ul>
		{/if}
		<p class="meta">{eaten}</p>
		{#if recipe.categoryGuessed}
			<p class="meta">Sort och bas gissade av Claude. Ändra under Redigera.</p>
		{/if}
		<div class="actions">
			<a
				class="kh-btn kh-btn--primary cook"
				href={resolve('/ratter/[id]/laga', { id: String(recipe.id) })}
			>
				<Icon name="cook" />Laga maten
			</a>
			<VoteButton name={recipe.name} {vote} onvote={setVote} />
		</div>
		<p class="meta">
			Tumme ner: Claude föreslår inte rätten igen, men den går att skriva in själv.
		</p>
		{#if voteFailed}
			<p class="error-text" role="alert">
				Det gick inte att spara. Kontrollera nätet och försök igen.
			</p>
		{/if}
	</section>

	{#if onlyName}
		<RecipeInvite
			recipeId={recipe.id}
			text={recipe.ingredientsGuessed
				? 'Claude har gissat ingredienserna till inköpslistan. Hämta receptet eller skriv in det när du vill.'
				: 'Rätten har bara ett namn. Lägg till ingredienser när du vill, så kommer de med på inköpslistan.'}
		/>
	{/if}

	{#if recipe.ingredients.length}
		<FoldCard
			title="Ingredienser"
			count={recipe.ingredients.length}
			note={recipe.ingredientsGuessed ? 'Gissade' : undefined}
		>
			<ul class="lines">
				{#each recipe.ingredients as line, i (i)}<li>{line}</li>{/each}
			</ul>
		</FoldCard>
	{/if}
	{#if steps.length || recipe.sourceUrl}
		<FoldCard title="Gör så här">
			{#if steps.length}
				<ol class="steps">
					{#each steps as step, i (i)}
						{#if step.number}
							<li><span class="number" aria-hidden="true">{step.number}</span>{step.text}</li>
						{:else}
							<li class="part">{step.text}</li>
						{/if}
					{/each}
				</ol>
			{/if}
			{#if recipe.sourceUrl}
				<p class="source">
					Från
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a page on another site -->
					<a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
						{URL.parse(recipe.sourceUrl)?.hostname ?? recipe.sourceUrl}
					</a>
				</p>
			{/if}
		</FoldCard>
	{/if}
	{#if recipe.weeks.length}
		<FoldCard title="Veckor med rätten" count={recipe.weeks.length} open={onlyName}>
			{#each recipe.weeks as week, i (i)}
				<a class="kh-row" href="{resolve('/veckor')}#vecka-{week.menuId}">
					<span class="kh-row__text">
						<span class="kh-row__title">{weekName(week.weekStart)}</span>
					</span>
					<span class="kh-row__subtitle">{MEAL_LABELS[week.meal]}</span>
				</a>
			{/each}
		</FoldCard>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
		padding-block: var(--kh-space-s) var(--kh-space-l);
	}

	.kh-pills {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.meta {
		margin: 0;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--kh-space-s);
	}

	.cook {
		flex: 1;
	}

	.lines {
		margin: 0;
		padding: 0 0 var(--kh-space-xs);
		list-style: none;
	}

	.lines li {
		min-height: 2.375rem;
		padding: 0.375rem var(--kh-space-l);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--kh-space-m);
		font: var(--kh-type-body);
	}

	.lines li::before {
		content: '';
		width: 0.3125rem;
		height: 0.3125rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--kh-outline-variant);
	}

	.steps {
		margin: 0;
		padding: 0.125rem var(--kh-space-l) var(--kh-space-s);
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	.steps li {
		display: flex;
		gap: var(--kh-space-m);
		font: var(--kh-type-body);
		white-space: pre-line;
	}

	.part {
		margin-top: var(--kh-space-xs);
		font-weight: 700;
	}

	.number {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		border-radius: 0.75rem;
		background: var(--kh-primary-container);
		color: var(--kh-on-primary-container);
		font: var(--kh-type-caption);
		display: grid;
		place-items: center;
	}

	.source {
		margin: 0;
		padding: var(--kh-space-xs) var(--kh-space-l) var(--kh-space-m);
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	.source a {
		color: var(--kh-primary);
	}
</style>
