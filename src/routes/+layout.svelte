<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto, invalidate, invalidateAll, preloadData } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page, updated } from '$app/state';
	import { sendIdentity } from '#lib/account.ts';
	import '@kodhast/web-ui/tokens.css';
	import '@kodhast/web-ui/kh.css';
	import '#lib/tema.css';
	import '#lib/app.css';
	import favicon from '#lib/assets/favicon.svg';
	import Icon from '#lib/Icon.svelte';
	import Snackbar from '#lib/Snackbar.svelte';
	import { neighbour, swipeNav, type Direction } from '#lib/swipe.ts';
	import { provideToolbarAction } from '#lib/toolbar.svelte.ts';
	import { swedishToday } from '#lib/weeks.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The main views, as tabs in the toolbar at the bottom. A dish and its form have a back button
	// instead.
	const destinations = [
		{ href: '/', label: 'Veckan', icon: 'week' },
		{ href: '/handla', label: 'Handla', icon: 'shop' },
		{ href: '/ratter', label: 'Rätter', icon: 'dishes' },
		{ href: '/veckor', label: 'Veckor', icon: 'history' }
	] as const;

	let showNav = $derived(destinations.some((d) => d.href === page.url.pathname));

	const action = provideToolbarAction();

	// A swipe sideways goes to the view next to this one in the menu.
	const paths = destinations.map((d) => d.href);
	const swipe = swipeNav(
		(direction: Direction) => neighbour(paths, page.url.pathname, direction),
		(path) => goto(resolve(path)),
		// Only ahead of time; the view loads again when it is gone to.
		(path) => void preloadData(resolve(path)).catch(() => {})
	);

	// The name and Google picture are fetched once a week, after the page has loaded, and shown
	// once saved, without anything else on the page loading again.
	onMount(() => {
		if (page.data.account?.refresh) {
			sendIdentity().then((saved) => {
				if (saved) invalidate('app:account');
			});
		}
	});

	// web-ui's elements touch `customElements`, which only exists in the browser, so they are
	// registered after hydration instead of during SSR. `data-ready` tells the tests that the
	// components are there.
	onMount(() => {
		import('@kodhast/web-ui/kh.js').then(() => (document.documentElement.dataset.ready = ''));
	});

	// After a release, the next navigation loads the new version in full instead
	// of mixing old and new code in a tab that stayed open.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) {
			location.href = to.url.href;
		}
	});

	// A phone keeps the app open for days. When it comes back on another day, the week to show
	// may have changed, so the page loads again before anything is written to the old one.
	let loadedOn = swedishToday();
	function loadIfNewDay() {
		if (document.visibilityState !== 'visible' || swedishToday() === loadedOn) return;
		loadedOn = swedishToday();
		invalidateAll();
	}
</script>

<svelte:document onvisibilitychange={loadIfNewDay} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Veckans mat</title>
</svelte:head>

<div class="app kh-app kh-depth">
	<div class="content" class:floating={showNav} {@attach showNav && swipe}>
		{@render children()}
	</div>
	{#if showNav}
		<kh-toolbar class="kh-toolbar--fixed">
			<nav class="kh-toolbar__tabs" aria-label="Huvudmeny">
				{#each destinations as d (d.href)}
					{@const current = d.href === page.url.pathname}
					<a
						class="kh-toolbar__tab"
						href={resolve(d.href)}
						aria-current={current ? 'page' : undefined}
						aria-label={d.label}
					>
						<Icon name={d.icon} /><span class="kh-toolbar__label">{d.label}</span>
					</a>
				{/each}
			</nav>
			{#if action.current}
				{@const { label } = action.current}
				{#if 'href' in action.current}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a view gives a path of its own -->
					<a class="kh-toolbar__action" href={action.current.href} aria-label={label}>
						<Icon name="add" />
					</a>
				{:else}
					<button
						class="kh-toolbar__action"
						type="button"
						aria-label={label}
						onclick={action.current.onclick}
					>
						<Icon name="add" />
					</button>
				{/if}
			{/if}
		</kh-toolbar>
	{/if}
</div>
{#if updated.current}
	<div class="new-version">
		<Snackbar
			text="Ny version finns"
			action="Ladda om"
			duration={0}
			onclose={() => location.reload()}
		/>
	</div>
{/if}

<style>
	/* "Ny version finns" steps aside while another snackbar, such as Ångra, shows, and comes back
	   after it. */
	:global(body:has(.kh-snackbar-host:not(.new-version *))) .new-version {
		display: none;
	}

	:global(body) {
		margin: 0;
	}

	/* White cards on a warm background (#21, #73). */
	.app {
		/* Fields in a card have a warm fill. */
		--app-fill: color-mix(in srgb, var(--kh-primary) 4%, #f9f8f7);
		--app-card: var(--kh-card);
		--app-card-shadow: 0 1px 2px rgb(60 30 15 / 0.06);
		/* What the view lies on, for what must cover it, such as a header that stays on top. */
		--app-page: var(--kh-background);
		/* The suggestions under a dish being written. */
		--app-surface: #fefefd;

		min-height: 100dvh;
		/* A view swiped out to the side does not make the page scroll sideways. */
		overflow-x: clip;
		display: flex;
		flex-direction: column;
	}

	@media (prefers-color-scheme: dark) {
		.app {
			--app-surface: #131313;
			--app-fill: var(--kh-surface-variant);
			--app-card-shadow: none;
		}
	}

	.content {
		flex-grow: 1;
		display: flow-root;
	}

	/* Room at the end of a view, so its last row can be scrolled up above the toolbar. */
	.content.floating {
		padding-bottom: calc(var(--kh-toolbar-clearance) + env(safe-area-inset-bottom));
	}
</style>
