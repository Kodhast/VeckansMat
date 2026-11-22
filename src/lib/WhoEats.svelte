<script lang="ts">
	import Icon from './Icon.svelte';
	import { listText } from './names.ts';
	import Sheet from './Sheet.svelte';

	// Who eats the week, as a line on the menu that opens a sheet with a chip for each person. The
	// people, what they do not eat and the rules are set in Inställningar.
	let {
		people,
		eaterIds,
		ontoggle
	}: {
		people: { id: number; name: string }[];
		eaterIds: number[];
		ontoggle: (id: number, selected: boolean) => void;
	} = $props();

	let eaters = $derived(people.filter((p) => eaterIds.includes(p.id)));
	let line = $derived(
		eaters.length
			? `${listText(eaters.map((p) => p.name))} äter`
			: people.length
				? 'Välj vilka som äter'
				: 'Lägg till vilka som äter'
	);
	let open = $state(false);
</script>

<button type="button" class="line" onclick={() => (open = true)}>
	<Icon name="people" />{line}
</button>

<Sheet {open} title="Vilka äter?" onclose={() => (open = false)}>
	{#if people.length === 0}
		<p class="hint">Lägg till personer under Inställningar.</p>
	{:else}
		<div class="kh-chips">
			{#each people as person (person.id)}
				{@const selected = eaterIds.includes(person.id)}
				<button
					type="button"
					class="kh-chip"
					aria-pressed={selected}
					onclick={() => ontoggle(person.id, !selected)}
				>
					{person.name}
				</button>
			{/each}
		</div>
	{/if}
</Sheet>

<style>
	.line {
		position: relative;
		align-self: center;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 1.125rem;
		background: var(--menu-chip);
		color: var(--kh-on-surface-variant);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	/* A taller place to tap than the line looks. */
	.line::after {
		content: '';
		position: absolute;
		inset: -0.375rem 0;
	}

	.line :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
