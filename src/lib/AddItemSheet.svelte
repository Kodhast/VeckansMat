<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	// A field for a new item that lies just above the keyboard. Enter adds the item and the field
	// stays for the next one; the cross, Escape or a tap elsewhere closes it.
	let { open = $bindable(false), onadd }: { open?: boolean; onadd: (text: string) => void } =
		$props();

	let draft = $state('');
	let input: HTMLInputElement | undefined = $state();
	let form: HTMLFormElement | undefined = $state();
	// How far up the keyboard reaches, which the page does not move for on every phone.
	let keyboard = $state(0);

	$effect(() => {
		if (!open) return;
		tick().then(() => input?.focus());
		const viewport = window.visualViewport;
		if (!viewport) return;
		const measure = () =>
			(keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
		measure();
		viewport.addEventListener('resize', measure);
		viewport.addEventListener('scroll', measure);
		return () => {
			viewport.removeEventListener('resize', measure);
			viewport.removeEventListener('scroll', measure);
			keyboard = 0;
		};
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (text) onadd(text);
		draft = '';
		input?.focus();
	}

	function leave(event: FocusEvent) {
		if (!form?.contains(event.relatedTarget as Node | null)) open = false;
	}
</script>

{#if open}
	<form
		bind:this={form}
		class="sheet"
		style:bottom="{keyboard}px"
		onsubmit={submit}
		onfocusout={leave}
	>
		<input
			bind:this={input}
			bind:value={draft}
			aria-label="Lägg till en vara"
			placeholder="Lägg till en vara"
			autocomplete="off"
			enterkeyhint="done"
			maxlength="200"
			onkeydown={(e) => e.key === 'Escape' && (open = false)}
		/>
		<button type="submit" class="kh-icon-btn kh-icon-btn--tonal" aria-label="Lägg till">
			<Icon name="add" />
		</button>
		<button type="button" class="kh-icon-btn" aria-label="Stäng" onclick={() => (open = false)}>
			<Icon name="close" />
		</button>
	</form>
{/if}

<style>
	/* web-ui's sheet is a modal dialog, which would close at each item; this one lies over the
	   tabs, just above the keyboard, with the sheet's shape and web-ui's field and buttons. */
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		/* Over the tabs and the plus button, which it stands in for while open. */
		z-index: 4;
		padding: var(--kh-space-m) var(--kh-space-s)
			calc(var(--kh-space-m) + env(safe-area-inset-bottom)) var(--kh-space-l);
		border-radius: var(--kh-radius-sheet);
		background: var(--kh-card);
		box-shadow: 0 -4px 18px color-mix(in srgb, var(--kh-scrim) 16%, transparent);
		display: flex;
		align-items: center;
		gap: var(--kh-space-xs);
	}

	input {
		flex: 1;
		min-width: 0;
		height: 3rem;
		padding: 0 var(--kh-space-l);
		border: 0;
		border-radius: var(--kh-radius-pill);
		background: var(--kh-row-tint);
		color: inherit;
		font: var(--kh-type-body);
		outline: none;
	}

	input:focus-visible {
		box-shadow: inset 0 0 0 2px var(--kh-primary);
	}
</style>
