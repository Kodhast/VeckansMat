<script lang="ts">
	import type { Snippet } from 'svelte';

	// web-ui's sheet (kh-sheet, AppBottomSheet): a modal dialog from the bottom. A tap beside it
	// or the back button closes it, and the app hears it through onclose.
	let {
		open,
		title,
		full = false,
		onclose,
		children
	}: {
		open: boolean;
		title: string;
		/** As tall as the screen allows, so that a list that is filtered does not make it jump. */
		full?: boolean;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// A tap on the backdrop lands on the dialog itself, as does one on the sheet's own padding, so
	// where it landed tells them apart.
	function tapOutside(event: MouseEvent) {
		if (event.target !== dialog) return;
		const { left, right, top, bottom } = dialog.getBoundingClientRect();
		const { clientX: x, clientY: y } = event;
		if (x < left || x > right || y < top || y > bottom) dialog.close();
	}
</script>

<dialog
	bind:this={dialog}
	class={['kh-sheet', full && 'full']}
	aria-label={title}
	onclose={() => open && onclose()}
	onclick={tapOutside}
>
	<h2 class="kh-sheet__title">{title}</h2>
	{@render children()}
</dialog>

<style>
	/* A sheet in the menu's centred heading still reads from the left. */
	.kh-sheet {
		text-align: start;
	}

	/* As tall as web-ui lets a sheet be. */
	.full {
		block-size: 100%;
	}
</style>
