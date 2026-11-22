<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';

	// For a dish with only a name: what there is of it, and the ways to get its recipe, on a card in
	// the primary tone (web-ui's kh-card--tone).
	let { recipeId, text }: { recipeId: number; text: string } = $props();
	let id = $derived(String(recipeId));
</script>

<section class="kh-card kh-card--tone">
	<p>{text}</p>
	<div class="actions">
		<a class="kh-btn" href="{resolve('/ratter/ny')}?till={recipeId}">
			<Icon name="camera" />Hämta receptet
		</a>
		<a class="kh-btn kh-btn--text" href={resolve('/ratter/[id]/redigera', { id })}>
			Skriv in själv
		</a>
	</div>
</section>

<style>
	section {
		color: var(--kh-on-primary-container);
	}

	p {
		margin: 0;
		font: var(--kh-type-body-medium);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--kh-space-s);
	}

	.kh-btn--text {
		color: inherit;
	}
</style>
