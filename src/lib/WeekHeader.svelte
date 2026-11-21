<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppHeader from './AppHeader.svelte';
	import WeekArrows from './WeekArrows.svelte';
	import { isoWeek } from './weeks.ts';

	// The top of a view about this week or the next: the header with the view's title, and under it
	// the arrows between the two weeks. Without a title the week is the title (Veckan).
	let {
		weekStart,
		thisWeek,
		nextWeek,
		title,
		actions
	}: {
		weekStart: string;
		thisWeek: string;
		nextWeek: string;
		title?: string;
		/** Buttons before the arrows. */
		actions?: Snippet;
	} = $props();

	let week = $derived(`Vecka ${isoWeek(weekStart).week}`);
	let which = $derived(weekStart === nextWeek ? 'Nästa vecka' : 'Den här veckan');
</script>

<AppHeader title={title ?? week} subtitle={title ? `${week} · ${which.toLowerCase()}` : which} />

<div class="week-nav">
	{@render actions?.()}
	<WeekArrows {weekStart} {thisWeek} {nextWeek} />
</div>

<style>
	.week-nav {
		max-width: 40rem;
		margin: 0 auto;
		padding: 0 0.5rem;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}
</style>
