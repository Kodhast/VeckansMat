<script lang="ts">
	import Icon from './Icon.svelte';

	// An item on the shopping list (web-ui's kh-check-row in a kh-swipe, as CheckRow and SwipeToHide
	// in android-ui): tick it off, see which dishes it is for, or swipe it away to the left, which
	// the snackbar can undo (android-ui #118); Ta bort also stands last in the row's popup. The
	// amount is a button of its own, which opens the sheet to change it (#163).
	let {
		text,
		amount,
		amountEdited = false,
		question = '',
		note = '',
		dishes,
		checked,
		oncheck,
		onamount,
		onremove
	}: {
		text: string;
		amount: string | null;
		/** Whether the amount was changed by hand, which the pen beside it shows. */
		amountEdited?: boolean;
		/** What the item asks when its dishes changed since its amount was changed by hand (#197). */
		question?: string;
		/** What the popup says about the amount, such as what Claude worked out. */
		note?: string;
		/** The dishes it is for, as one line, or empty. */
		dishes: string;
		checked: boolean;
		oncheck: (checked: boolean) => void;
		onamount: () => void;
		onremove: () => void;
	} = $props();

	const id = $props.id();

	// web-ui's kh-swipe says so when the row is swiped far enough; the row to the right is the
	// page's (#105), which kh-swipe marks with data-own-swipe itself.
	let swipe: HTMLElement | undefined = $state();
	$effect(() => {
		const element = swipe;
		if (!element) return;
		const removed = () => onremove();
		element.addEventListener('kh-swipe', removed);
		return () => element.removeEventListener('kh-swipe', removed);
	});

	// The popup with the dishes opens under its button, in the top layer.
	let info: HTMLElement | undefined = $state();
	let infoButton: HTMLElement | undefined = $state();
	function place(event: ToggleEvent) {
		if (event.newState !== 'open' || !info || !infoButton) return;
		const rect = infoButton.getBoundingClientRect();
		info.style.top = `${rect.bottom + 4}px`;
		info.style.right = `${document.documentElement.clientWidth - rect.right}px`;
	}

	function remove() {
		info?.hidePopover();
		onremove();
	}
</script>

<li>
	<kh-swipe bind:this={swipe} label="Ta bort" tone="hide">
		<div class={['line', checked && 'checked']}>
			<label class="kh-row kh-check-row kh-check-row--plain">
				<span class="kh-row__leading">
					<input
						type="checkbox"
						class="kh-check"
						aria-label={text}
						{checked}
						onchange={(e) => oncheck(e.currentTarget.checked)}
					/>
				</span>
				<span class="kh-row__text">
					<span class="kh-row__title">{text}</span>
					{#if question}<span class="kh-row__subtitle question">{question}</span>{/if}
				</span>
			</label>
			<!-- On every row, with Ta bort last, since a mouse cannot swipe (android-ui #118). -->
			<button
				bind:this={infoButton}
				type="button"
				class="kh-icon-btn info"
				aria-label={dishes ? `Till vilka rätter: ${text}` : `Mer om ${text}`}
				popovertarget="{id}-info"
			>
				<Icon name="info" />
			</button>
			<div bind:this={info} id="{id}-info" class="popup" popover="auto" ontoggle={place}>
				{#if dishes}
					<strong>Till</strong>
					<span>{dishes}</span>
				{/if}
				{#if note}<span class="note">{note}</span>{/if}
				<button type="button" class="remove" aria-label="Ta bort {text}" onclick={remove}>
					<Icon name="delete" />Ta bort
				</button>
			</div>
			<button
				type="button"
				class={['amount', amountEdited && 'edited', !amount && 'none', question && 'asks']}
				aria-label="Ändra mängd: {text}"
				onclick={onamount}
			>
				{#if question}<span class="dot"></span>{:else if amountEdited}<Icon
						name="edit"
					/>{/if}{amount || '+ mängd'}
			</button>
		</div>
	</kh-swipe>
</li>

<style>
	/* The row lies on the open section's tint, also while it is pulled aside. */
	.line {
		position: relative;
		padding-right: var(--kh-space-m);
		background-color: var(--kh-foldout-surface, var(--kh-row-tint));
		display: flex;
		align-items: center;
	}

	.kh-check-row {
		flex: 1;
		min-width: 0;
		padding-right: 0;
	}

	.checked :is(.kh-row__title, .amount) {
		color: var(--kh-on-surface-variant);
		text-decoration: line-through;
	}

	/* An item that asks shows it in the app's colour, under the name and beside the amount. */
	.question {
		color: var(--kh-primary);
		font-weight: 500;
	}

	.dot {
		inline-size: 0.5rem;
		block-size: 0.5rem;
		border-radius: 50%;
		background-color: var(--kh-primary);
	}

	.info {
		flex-shrink: 0;
		color: var(--kh-on-surface-variant);
	}

	.info :global(svg) {
		width: 1.125rem;
	}

	/* As tall as the row, so that a tap beside the text still changes the amount rather than
	   ticking the item off. */
	.amount {
		min-width: 4rem;
		min-height: 48px;
		margin: 0;
		padding: 0 0 0 var(--kh-space-s);
		border: 0;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		font: var(--kh-type-item-subtitle);
		font-weight: 500;
		color: var(--kh-on-surface-variant);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		cursor: pointer;
	}

	.amount:focus-visible {
		outline: 2px solid var(--kh-primary);
		border-radius: var(--kh-radius-row);
	}

	.amount.none {
		color: var(--kh-primary);
		opacity: 0.8;
	}

	/* Changed by hand: a pen and a stronger tone. */
	.amount.edited {
		color: var(--kh-on-surface);
		font-weight: 600;
	}

	.amount.asks {
		color: var(--kh-primary);
	}

	.amount :global(svg) {
		width: 0.875rem;
		color: var(--kh-primary);
	}

	.popup .note {
		margin-top: 0.25rem;
	}

	.popup {
		position: fixed;
		inset: auto;
		max-width: 15rem;
		margin: 0;
		padding: 0.625rem 0.875rem;
		border: 0;
		border-radius: var(--kh-radius-row);
		background: var(--kh-inverse-surface);
		color: var(--kh-inverse-on-surface);
		box-shadow: 0 6px 18px color-mix(in srgb, var(--kh-scrim) 25%, transparent);
		font: var(--kh-type-item-subtitle);
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
	}

	.popup:popover-open {
		display: flex;
	}

	.popup strong {
		font: var(--kh-type-caption);
		letter-spacing: var(--kh-tracking-caption);
		text-transform: uppercase;
		opacity: 0.8;
	}

	.popup .remove {
		margin: 0.375rem 0 0 -0.25rem;
		padding: 0.25rem;
		border: 0;
		background: transparent;
		color: var(--kh-inverse-primary);
		font: var(--kh-type-button);
		display: flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
	}

	.popup .remove :global(svg) {
		width: 1rem;
	}
</style>
