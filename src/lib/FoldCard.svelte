<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { Look } from './shopping';

	// A card whose content folds away under its heading (web-ui's kh-card with a kh-foldout, as the
	// sections of a dish in android-ui): the heading is a row with an icon on a coloured shape, a
	// short note under the title, a count and the chevron.
	let {
		title,
		look,
		count,
		note,
		open = $bindable(true),
		children
	}: {
		title: string;
		look?: Look;
		count?: number;
		note?: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	const id = $props.id();
</script>

<section class="kh-card">
	<div class="kh-foldout">
		<h2>
			<button
				type="button"
				class="kh-row kh-foldout__header"
				aria-expanded={open}
				aria-controls={id}
				onclick={() => (open = !open)}
			>
				{#if look}
					<span
						class="look"
						style:background={look.tint}
						style:color={look.ink}
						style:border-radius={look.shape}
					>
						<Icon name={look.icon} />
					</span>
				{/if}
				<span class="kh-row__text">
					<span class="kh-row__title">{title}</span>
					{#if note}<span class="kh-row__subtitle">{note}</span>{/if}
				</span>
				{#if count !== undefined}<span class="count">{count}</span>{/if}
				<span class="kh-foldout__chevron"><Icon name="expand" /></span>
			</button>
		</h2>
		<div {id} class="kh-foldout__content" hidden={!open}>
			{@render children()}
		</div>
	</div>
</section>

<style>
	/* The rows inside go almost to the card's edge, as in android-ui's sections. */
	.kh-card {
		padding: var(--kh-space-xs);
		gap: 0;
	}

	/* The heading holds the row, so web-ui's tint of an open foldout is set here. */
	.kh-foldout:has(> h2 > [aria-expanded='true']) {
		background-color: var(--kh-foldout-surface);
	}

	h2 {
		font: inherit;
	}

	.look {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		display: grid;
		place-items: center;
	}

	.look :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}

	.count {
		font: var(--kh-type-item-subtitle);
		font-variant-numeric: tabular-nums;
		color: var(--kh-on-surface-variant);
	}

	.kh-foldout__chevron {
		display: flex;
	}
</style>
