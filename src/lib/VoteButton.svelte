<script lang="ts">
	import Icon from './Icon.svelte';
	import { nextVote, VOTES, type Vote } from './recipes.ts';

	// One button for what the household thinks of a dish (#99): a tap gives the next vote, round
	// from thumb up to thumb down. The same quiet tone in every state, so that only the thumb
	// shows the vote and thumb up never looks like a warning.
	let {
		name,
		vote,
		onvote
	}: {
		/** The dish, for screen readers. */
		name: string;
		vote: Vote | null;
		onvote: (vote: Vote) => void;
	} = $props();

	let label = $derived(VOTES.find((v) => v.key === vote)?.label ?? 'Hur var den?');
</script>

<button
	type="button"
	class={['kh-btn kh-btn--secondary kh-btn--compact vote', vote ?? 'none']}
	aria-label="Röst på {name}: {label}. Tryck för att ändra."
	onclick={() => onvote(nextVote(vote))}
>
	<Icon name="thumbUp" />{label}
</button>

<style>
	.vote {
		flex-shrink: 0;
	}

	.none {
		color: var(--kh-on-surface-variant);
	}

	.vote > :global(svg) {
		transition: transform 0.25s;
	}

	.ok > :global(svg) {
		transform: rotate(-90deg);
	}

	.aldrig > :global(svg) {
		transform: scaleY(-1);
	}
</style>
