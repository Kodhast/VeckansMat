<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	// The account in the header, and its menu under it (android-ui's AccountMenu, variant B in #102):
	// the same first level as in every Kodhäst app. Logga ut only when Access has logged someone in.
	let account = $derived(page.data.account);

	// The dot on the avatar, as in every Kodhäst app (web-ui 3.1.0): logged in and online green, logged in
	// without a connection a grey hollow ring, not logged in none. Online is the browser's own notion.
	let online = $state(true);
	$effect(() => {
		const update = () => (online = navigator.onLine);
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});
	let dot = $derived(account ? (online ? ' kh-avatar--online' : ' kh-avatar--offline') : '');
	let label = $derived(
		(account?.name ? `Konto, ${account.name}` : 'Konto') +
			(account && !online ? ', ingen anslutning' : '')
	);
</script>

<button class={`kh-avatar${dot}`} type="button" popovertarget="kontomeny" aria-label={label}>
	<span class="kh-avatar__circle"><Avatar /></span>
</button>

<div class="kh-menu" id="kontomeny" popover="" role="menu" aria-label="Konto">
	{#if account}
		<div class="kh-row who">
			<span class="kh-row__leading">
				<span class="kh-avatar"><span class="kh-avatar__circle"><Avatar /></span></span>
			</span>
			<span class="kh-row__text">
				{#if account.name}<span class="kh-row__title">{account.name}</span>{/if}
				<span class="kh-row__subtitle">{account.email}</span>
			</span>
		</div>
		<hr class="kh-divider" />
	{/if}
	<a class="kh-menu__item" role="menuitem" href={resolve('/installningar')}>
		<Icon name="settings" />Inställningar
	</a>
	<a class="kh-menu__item" role="menuitem" href={resolve('/om')}><Icon name="info" />Om appen</a>
	{#if account}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Access logs out, not the app, so the app is left in full -->
		<a class="kh-menu__item" role="menuitem" href="/cdn-cgi/access/logout" data-sveltekit-reload>
			<Icon name="logout" />Logga ut
		</a>
	{/if}
</div>

<style>
	/* The picture or letter fills the avatar's circle. */
	.kh-avatar__circle :global(:is(img, span)) {
		width: 100%;
		height: 100%;
	}

	.who {
		pointer-events: none;
	}
</style>
