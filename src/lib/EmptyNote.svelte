<script lang="ts">
	import type { Snippet } from 'svelte';
	import KodhastMark from './KodhastMark.svelte';

	// What a list says when it has nothing yet, under Kodhäst's mark.
	let { children }: { children: Snippet } = $props();
</script>

<div class="empty">
	<KodhastMark size="3rem" />
	<p>{@render children()}</p>
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		text-align: center;
		color: var(--md-sys-color-on-surface-variant);
	}

	p {
		margin: 0;
		max-width: 20rem;
	}
</style>
