<script lang="ts">
	import { version } from '$app/env';
	import { resolve } from '$app/paths';
	import Icon from '#lib/Icon.svelte';
	import KodhastMark from '#lib/KodhastMark.svelte';

	// Om appen, from the account menu as in every Kodhäst app: the version, where the changes and the
	// code are, and Kodhäst's signature, which used to be the footer (#168, #174).
	const repo = 'https://github.com/Kodhast/VeckansMat';
</script>

<svelte:head>
	<title>Om appen – Veckans mat</title>
</svelte:head>

<header class="kh-topbar">
	<a class="kh-icon-btn kh-icon-btn--tonal" href={resolve('/')} aria-label="Tillbaka">
		<Icon name="back" />
	</a>
	<h1 class="kh-topbar__title"><kh-dots></kh-dots><span>Om appen</span></h1>
</header>

<main class="kh-page">
	<section class="kh-card about">
		<img src="/icon-192.png" alt="" width="56" height="56" />
		<span class="kh-text-headline">Veckans mat</span>
		<span class="meta">Version {version}</span>
		<p>Veckomeny och inköpslista för hushållet.</p>
	</section>

	<section class="kh-card links">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- pages outside the app -->
		<a class="kh-row" href="{repo}/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">
			<span class="kh-row__text">
				<span class="kh-row__title">Vad är nytt</span>
				<span class="kh-row__subtitle">Ändringslistan</span>
			</span>
			<span class="kh-chevron"></span>
		</a>
		<a class="kh-row" href={repo} target="_blank" rel="noreferrer">
			<span class="kh-row__text">
				<span class="kh-row__title">Källkoden</span>
				<span class="kh-row__subtitle">github.com/Kodhast/VeckansMat</span>
			</span>
			<span class="kh-chevron"></span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</section>

	<p class="signature"><KodhastMark size="2rem" />En kodhäst-app</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding-block: 0.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	.about {
		align-items: center;
		text-align: center;
	}

	.about p {
		margin: 0;
	}

	.links {
		padding: var(--kh-space-xs);
		gap: 0;
	}

	.signature {
		margin: var(--kh-space-xl) 0 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--kh-space-s);
		font: var(--kh-type-caption);
		letter-spacing: var(--kh-tracking-caption);
		text-transform: uppercase;
		color: var(--kh-on-surface-variant);
	}

	/* The horse in the text's colour, as in the footer it replaces. */
	.signature :global(svg) {
		color: var(--kh-on-surface);
	}
</style>
