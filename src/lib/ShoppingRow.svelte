<script lang="ts">
	import Icon from './Icon.svelte';

	// An item on the shopping list (web-ui's kh-check-row in a kh-swipe, as CheckRow and SwipeToHide
	// in android-ui): tick it off, see which dishes it is for, or swipe it away to the left, which
	// the snackbar can undo (android-ui #118).
	let {
		text,
		amount,
		dishes,
		checked,
		oncheck,
		onremove
	}: {
		text: string;
		amount: string | null;
		/** The dishes it is for, as one line, or empty. */
		dishes: string;
		checked: boolean;
		oncheck: (checked: boolean) => void;
		onremove: () => void;
	} = $props();

	const id = $props.id();

	// web-ui's kh-swipe says so when the row is swiped far enough; the row to the right is the
	// page's (#105), which kh-swipe marks with data-own-swipe itself.
	let swipe: HTMLElement | undefined = $state();
	$effect(() => {
		if (!swipe) return;
		const removed = () => onremove();
		swipe.addEventListener('kh-swipe', removed);
		return () => swipe?.removeEventListener('kh-swipe', removed);
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
				<span class="kh-row__text"><span class="kh-row__title">{text}</span></span>
			</label>
			{#if dishes}
				<button
					bind:this={infoButton}
					type="button"
					class="kh-icon-btn info"
					aria-label="Till vilka rätter: {text}"
					popovertarget="{id}-info"
				>
					<Icon name="info" />
				</button>
				<div bind:this={info} id="{id}-info" class="popup" popover="auto" ontoggle={place}>
					<strong>Till</strong>
					<span>{dishes}</span>
					<button type="button" class="remove" aria-label="Ta bort {text}" onclick={remove}>
						<Icon name="delete" />Ta bort
					</button>
				</div>
			{:else}
				<!-- Swiping is not for everyone, so the row can be removed with a button too. -->
				<button type="button" class="remove hidden" onclick={onremove}>Ta bort {text}</button>
			{/if}
			{#if amount}<span class="amount">{amount}</span>{/if}
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

	.info {
		flex-shrink: 0;
		color: var(--kh-on-surface-variant);
	}

	.info :global(svg) {
		width: 1.125rem;
	}

	.amount {
		min-width: 4rem;
		padding-left: var(--kh-space-s);
		text-align: right;
		font: var(--kh-type-item-subtitle);
		font-weight: 500;
		color: var(--kh-on-surface-variant);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* No info button: the amount stands where it would, as the rows' amounts line up. */
	.hidden + .amount {
		margin-left: 48px;
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

	/* Out of sight until it has the focus, as from the keyboard. */
	.remove.hidden {
		position: absolute;
		right: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 0;
		border-radius: 1rem;
		background: var(--kh-error-container);
		color: var(--kh-on-error-container);
		font: var(--kh-type-button);
		clip-path: inset(50%);
	}

	.remove.hidden:focus {
		clip-path: none;
	}
</style>
