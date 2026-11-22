<script lang="ts">
	import Sheet from './Sheet.svelte';
	import type { ShoppingItem } from './server/db/shopping.ts';
	import { stepAmount } from './shopping.ts';

	// How much of an item to buy, changed by hand (#163): a field with − and + for its first number,
	// what Claude worked out, and the way back to it. The amount is free text, as Claude writes it.
	let {
		item,
		dishes,
		onsave,
		onreset,
		onclose
	}: {
		/** The item whose amount is changed, or null when the sheet is closed. */
		item: ShoppingItem | null;
		/** The dishes it is for, as one line, or empty. */
		dishes: string;
		onsave: (amount: string) => void;
		onreset: () => void;
		onclose: () => void;
	} = $props();

	let draft = $state('');
	// The sheet keeps the last item while it closes, so that its text does not go blank first.
	let shown = $state<ShoppingItem | null>(null);
	$effect.pre(() => {
		if (!item) return;
		shown = item;
		draft = item.amount ?? '';
	});

	let claudes = $derived(shown?.amountEdited ? shown.amountBefore : shown?.amount);
	let fromClaude = $derived(shown?.origin === 'claude');
	let less = $derived(stepAmount(draft, -1));
	let more = $derived(stepAmount(draft, 1));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsave(draft);
	}
</script>

<Sheet open={!!item} title={shown?.text ?? ''} {onclose}>
	{#if dishes}<p class="kh-sheet__subtitle">Till {dishes}</p>{/if}
	<form id="amount-form" onsubmit={submit}>
		<button
			type="button"
			class="kh-stepper__button kh-stepper__button--decrease"
			aria-label="Mindre"
			disabled={less === draft}
			onclick={() => (draft = less)}
		></button>
		<label class="kh-field">
			<input
				class="kh-field__input"
				bind:value={draft}
				placeholder=" "
				autocomplete="off"
				enterkeyhint="done"
				maxlength="40"
			/>
			<span class="kh-field__label">Mängd</span>
		</label>
		<button
			type="button"
			class="kh-stepper__button kh-stepper__button--increase"
			aria-label="Mer"
			disabled={more === draft}
			onclick={() => (draft = more)}
		></button>
	</form>
	{#if fromClaude}
		<p class="claude">Claude räknade {claudes || 'ingen mängd'}</p>
	{/if}
	<div class="kh-sheet__footer">
		{#if shown?.amountEdited}
			<button type="button" class="kh-btn kh-btn--text" onclick={onreset}>
				{fromClaude ? 'Som Claude räknade' : 'Som förut'}
			</button>
		{/if}
		<button type="submit" form="amount-form" class="kh-btn save">Spara</button>
	</div>
</Sheet>

<style>
	form {
		display: flex;
		align-items: center;
		gap: var(--kh-space-s);
	}

	/* The field's label stands on its edge, which the margin above makes room for. */
	.kh-stepper__button {
		margin-block-start: 8px;
		background-color: var(--kh-row-tint);
	}

	.claude {
		margin: 0;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	.save {
		margin-inline-start: auto;
	}
</style>
