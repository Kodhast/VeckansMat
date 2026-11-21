<script lang="ts">
	import Icon from './Icon.svelte';

	// The top of a form that is a view of its own (web-ui's kh-topbar): a button that leaves it, its
	// title, and Spara. It stays on top while the form scrolls.
	let {
		title,
		back,
		backLabel = 'Avbryt',
		save = true
	}: { title: string; back: string; backLabel?: string; save?: boolean } = $props();
</script>

<header class="kh-topbar">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the views resolve it -->
	<a class="kh-icon-btn kh-icon-btn--tonal" href={back} aria-label={backLabel}>
		<Icon name="close" />
	</a>
	<h1 class="kh-topbar__title"><kh-dots></kh-dots><span>{title}</span></h1>
	{#if save}
		<div class="kh-topbar__actions">
			<button class="kh-btn kh-btn--compact">Spara</button>
		</div>
	{/if}
</header>

<style>
	/* The form's own margin is outside the bar. */
	.kh-topbar {
		margin-inline: -1rem;
	}
</style>
