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
	import { neighbour, swipeNav, type Direction } from '#lib/swipe.ts';
	import { provideToolbarAction } from '#lib/toolbar.svelte.ts';
	import { swedishToday } from '#lib/weeks.ts';
	import type { M3eSnackbarElement } from '@m3e/web/snackbar';
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

	// The m3e and web-ui elements touch `customElements`, which only exists in the browser, so they
	// are registered after hydration instead of during SSR. `data-ready` tells the tests that the
	// components are there.
	onMount(() => {
		Promise.all([import('#lib/m3e.ts'), import('@kodhast/web-ui/kh.js')]).then(
			() => (document.documentElement.dataset.ready = '')
		);
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

	// Opening another snackbar, such as an undo, closes this one, so it reloads only when the
	// action was tapped, and comes back once no other one is showing. An undo can also be taken
	// out of the page while it shows, without closing, so it is looked for rather than awaited.
	function reloadOnAction(event: ToggleEvent & { currentTarget: M3eSnackbarElement }) {
		if (event.newState !== 'closed') return;
		const notice = event.currentTarget;
		if (notice.isActionTaken) return location.reload();
		const snackbar = customElements.get('m3e-snackbar') as typeof M3eSnackbarElement;
		const waiting = setInterval(() => {
			const other = snackbar.current;
			if (other?.isConnected && other.open) return;
			clearInterval(waiting);
			notice.open = true;
		}, 500);
	}
</script>

<svelte:document onvisibilitychange={loadIfNewDay} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Veckans mat</title>
</svelte:head>

<!-- One colour, Saffran (#174): m3e builds the scheme of the parts not yet moved to web-ui from it,
     and the layout gives them web-ui's colours below. -->
<m3e-theme color="#7a5900" variant="tonal-spot" scheme="auto" motion="expressive" strong-focus>
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
		<m3e-snackbar action="Ladda om" duration="0" open ontoggle={reloadOnAction}>
			Ny version finns
		</m3e-snackbar>
	{/if}
</m3e-theme>

<style>
	/* m3e-theme only colours <body> when it is the body's direct child, which
	   SvelteKit's app.html wrapper rules out, so the app root takes the colours. */
	:global(body) {
		margin: 0;
	}

	/* An icon put in an m3e slot sits in a span, since a component cannot take slot="". */
	:global(.slot-icon) {
		display: inline-flex;
	}

	/* The parts still on m3e take web-ui's colours (src/lib/tema.css), so the whole app has one
	   palette until every view has moved to web-ui (#174). White cards on a warm background (#21, #73). */
	.app {
		--md-sys-color-primary: var(--kh-primary);
		--md-sys-color-on-primary: var(--kh-on-primary);
		--md-sys-color-primary-container: var(--kh-primary-container);
		--md-sys-color-on-primary-container: var(--kh-on-primary-container);
		--md-sys-color-secondary: var(--kh-secondary);
		--md-sys-color-on-secondary: var(--kh-on-secondary);
		--md-sys-color-secondary-container: var(--kh-secondary-container);
		--md-sys-color-on-secondary-container: var(--kh-on-secondary-container);
		--md-sys-color-error: var(--kh-error);
		--md-sys-color-on-error: var(--kh-on-error);
		--md-sys-color-error-container: var(--kh-error-container);
		--md-sys-color-on-error-container: var(--kh-on-error-container);
		--md-sys-color-inverse-surface: var(--kh-inverse-surface);
		--md-sys-color-inverse-on-surface: var(--kh-inverse-on-surface);
		--md-sys-color-inverse-primary: var(--kh-inverse-primary);
		--md-sys-color-background: var(--kh-background);
		--md-sys-color-on-background: var(--kh-on-background);
		--md-sys-color-surface: #fefefd;
		--md-sys-color-surface-bright: #fefefd;
		--md-sys-color-surface-dim: #dedddb;
		--md-sys-color-surface-container-lowest: #ffffff;
		--md-sys-color-surface-container-low: #f9f9f8;
		--md-sys-color-surface-container: #f4f4f2;
		--md-sys-color-surface-container-high: #efefec;
		--md-sys-color-surface-container-highest: #e9e9e6;
		--md-sys-color-surface-variant: var(--kh-surface-variant);
		--md-sys-color-on-surface: var(--kh-on-surface);
		--md-sys-color-on-surface-variant: var(--kh-on-surface-variant);
		--md-sys-color-outline: var(--kh-outline);
		--md-sys-color-outline-variant: var(--kh-outline-variant);
		/* Fields in a card have a warm fill. */
		--app-fill: color-mix(in srgb, var(--kh-primary) 4%, #f9f8f7);
		--app-card: var(--kh-card);
		--app-card-shadow: 0 1px 2px rgb(60 30 15 / 0.06);
		/* What the view lies on, for what must cover it, such as a header that stays on top. */
		--app-page: var(--kh-background);

		min-height: 100dvh;
		/* A view swiped out to the side does not make the page scroll sideways. */
		overflow-x: clip;
		display: flex;
		flex-direction: column;
	}

	@media (prefers-color-scheme: dark) {
		.app {
			--md-sys-color-surface: #131313;
			--md-sys-color-surface-bright: #3a3a39;
			--md-sys-color-surface-dim: #131313;
			--md-sys-color-surface-container-lowest: #0e0e0e;
			--md-sys-color-surface-container-low: #1c1c1b;
			--md-sys-color-surface-container: #201f1f;
			--md-sys-color-surface-container-high: #2a2a29;
			--md-sys-color-surface-container-highest: #353534;
			--app-fill: var(--md-sys-color-surface-container-highest);
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
