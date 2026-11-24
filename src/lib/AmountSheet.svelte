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
		onkeep,
		ontake,
		onclose
	}: {
		/** The item whose amount is changed, or null when the sheet is closed. */
		item: ShoppingItem | null;
		/** The dishes it is for, as one line, or empty. */
		dishes: string;
		onsave: (amount: string) => void;
		onreset: () => void;
		/** Keeps the amount changed by hand, when the dishes changed since (#197). */
		onkeep: () => void;
		/** Takes what Claude counts now instead. */
		ontake: () => void;
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
	// Asks to keep or take Claude's only while the amount is as it was; one written in is saved.
	let asks = $derived(!!shown?.amountChange && draft === (shown.amount ?? ''));
	const CHANGES = {
		added: 'En ny rätt behöver den här varan',
		removed: 'En rätt är borta från veckan',
		changed: 'Rätterna har ändrats'
	};

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsave(draft);
	}
</script>

<Sheet open={!!item} title={shown?.text ?? ''} {onclose}>
	{#if dishes}<p class="kh-sheet__subtitle">Till {dishes}</p>{/if}
	{#if shown?.amountChange}
		<div class="change">
			<strong>{CHANGES[shown.amountChange]}</strong>
			<span>
				Du ändrade till {shown.amount ?? 'ingen mängd'} innan.
				{shown.amountSuggested
					? `Claude räknar nu ${shown.amountSuggested}.`
					: 'Claude har ingen ny mängd.'}
			</span>
		</div>
	{/if}
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
	{#if fromClaude && !shown?.amountChange}
		<p class="claude">Claude räknade {claudes || 'ingen mängd'}</p>
	{/if}
	<div class="kh-sheet__footer">
		{#if asks}
			<button type="button" class="kh-btn kh-btn--text" onclick={onkeep}>
				Behåll {shown?.amount ?? 'ingen mängd'}
			</button>
			{#if shown?.amountSuggested}
				<button type="button" class="kh-btn kh-btn--primary save" onclick={ontake}>
					Ta Claudes {shown.amountSuggested}
				</button>
			{/if}
		{:else}
			{@render footer()}
		{/if}
	</div>
</Sheet>

{#snippet footer()}
	{#if shown?.amountEdited}
		<button type="button" class="kh-btn kh-btn--text" onclick={onreset}>
			{fromClaude ? 'Som Claude räknade' : 'Som förut'}
		</button>
	{/if}
	<button type="submit" form="amount-form" class="kh-btn kh-btn--primary save">Spara</button>
{/snippet}

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

	.change {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: var(--kh-space-m);
		border-radius: var(--kh-radius-row);
		background-color: var(--kh-primary-container);
		color: var(--kh-on-primary-container);
		font: var(--kh-type-item-subtitle);
	}

	.change strong {
		font: var(--kh-type-item-title);
	}

	.save {
		margin-inline-start: auto;
	}
</style>
