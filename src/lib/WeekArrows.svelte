<script lang="ts">
	import Icon from './Icon.svelte';

	// The arrows between this week and the next, on a view about one of them.
	let { weekStart, thisWeek, nextWeek }: { weekStart: string; thisWeek: string; nextWeek: string } =
		$props();

	let isNext = $derived(weekStart === nextWeek);
</script>

<!-- The week shown has no arrow to itself. Links resolved by the view, with the week after it. -->
{#if isNext}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="kh-icon-btn" href="?vecka={thisWeek}" aria-label="Den här veckan"
		><Icon name="previous" /></a
	>
	<button type="button" class="kh-icon-btn" disabled aria-label="Nästa vecka"
		><Icon name="next" /></button
	>
{:else}
	<button type="button" class="kh-icon-btn" disabled aria-label="Den här veckan"
		><Icon name="previous" /></button
	>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="kh-icon-btn" href="?vecka={nextWeek}" aria-label="Nästa vecka"><Icon name="next" /></a>
{/if}
