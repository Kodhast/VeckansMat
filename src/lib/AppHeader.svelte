<script lang="ts">
	import { version } from '$app/env';
	import AccountMenu from './AccountMenu.svelte';

	// The header of a main view (android-ui's AppHeader through web-ui's kh-header): the app's icon,
	// name and version, the account at the right, the view's title with Kodhäst's dots, and a line
	// under it. It shrinks as the page scrolls.
	let {
		title,
		subtitle,
		busy = false
	}: {
		title: string;
		subtitle?: string;
		/** The dots bounce while the view is fetching. */
		busy?: boolean;
	} = $props();
</script>

<kh-header>
	<img class="kh-header__icon" src="/icon-192.png" alt="" />
	<span class="kh-header__name">Veckans mat</span>
	<span class="kh-header__version">{version}</span>
	<div class="kh-header__trailing"><AccountMenu /></div>
	<h1 class="kh-header__title">
		<kh-dots bouncing={busy || undefined}></kh-dots><span>{title}</span>
	</h1>
	{#if subtitle}<p class="kh-header__subtitle">{subtitle}</p>{/if}
</kh-header>
