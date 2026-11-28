<script lang="ts">
	import Sheet from './Sheet.svelte';
	import type { ShoppingItem } from './server/db/shopping.ts';
	import { stepAmount } from './shopping.ts';

	// An item changed by hand: its text (#208) and how much to buy (#163), with − and + for the
	// amount's first number, what Claude wrote and worked out, and the way back to it. Both are free
	// text, as Claude writes them.
	let {
		item,
		focus = 'amount',
		dishes,
		onsave,
		onreset,
		onresettext,
		onkeep,
		ontake,
		onclose
	}: {
		/** The item that is changed, or null when the sheet is closed. */
		item: ShoppingItem | null;
		/** The field the sheet opens at: the text from Ändra, the amount from the amount. */
		focus?: 'text' | 'amount';
		/** The dishes it is for, as one line, or empty. */
		dishes: string;
		onsave: (text: string, amount: string) => void;
		onreset: () => void;
		onresettext: () => void;
		/** Keeps the amount changed by hand, when the dishes changed since (#197). */
		onkeep: () => void;
		/** Takes what Claude counts now instead. */
		ontake: () => void;
		onclose: () => void;
	} = $props();

	let text = $state('');
	let draft = $state('');
	let textField: HTMLInputElement | undefined = $state();
	let amountField: HTMLInputElement | undefined = $state();
	// The sheet keeps the last item while it closes, so that its text does not go blank first.
	let shown = $state<ShoppingItem | null>(null);
	$effect.pre(() => {
		if (!item) return;
		shown = item;
		text = item.text;
		draft = item.amount ?? '';
	});
	$effect(() => {
		if (item) (focus === 'text' ? textField : amountField)?.focus();
	});

	let claudes = $derived(shown?.amountEdited ? shown.amountBefore : shown?.amount);
	let fromClaude = $derived(shown?.origin === 'claude');
	let less = $derived(stepAmount(draft, -1));
	let more = $derived(stepAmount(draft, 1));
	// Asks to keep or take Claude's only while the item is as it was; one written in is saved.
	let asks = $derived(
		!!shown?.amountChange && draft === (shown.amount ?? '') && text === shown.text
	);
	const CHANGES = {
		added: 'En ny rätt behöver den här varan',
		removed: 'En rätt är borta från veckan',
		changed: 'Rätterna har ändrats'
	};

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsave(text, draft);
	}
</script>

<Sheet open={!!item} title="Ändra varan" {onclose}>
	{#if dishes}<p class="kh-sheet__subtitle">Till {dishes}</p>{/if}
	{#if shown?.amountChange}
		<div class="change">
			<strong>{CHANGES[shown.amountChange]}</strong>
			<span>
				{shown.amountEdited
					? `Du ändrade till ${shown.amount ?? 'ingen mängd'} innan.`
					: `Listan har ${shown.amount ?? 'ingen mängd'}.`}
				{shown.amountSuggested
					? `Claude räknar nu ${shown.amountSuggested}.`
					: 'Claude har ingen ny mängd.'}
			</span>
		</div>
	{/if}
	<form id="item-form" onsubmit={submit}>
		<label class="kh-field">
			<input
				class="kh-field__input"
				bind:value={text}
				bind:this={textField}
				placeholder=" "
				autocomplete="off"
				enterkeyhint="next"
				maxlength="200"
				required
			/>
			<span class="kh-field__label">Vara</span>
		</label>
		<div class="amount">
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
					bind:this={amountField}
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
		</div>
	</form>
	{#if fromClaude && !shown?.amountChange}
		<p class="claude">
			{shown?.textBefore ? `Claude skrev ${shown.textBefore} och räknade` : 'Claude räknade'}
			{claudes || 'ingen mängd'}
		</p>
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
	{#if shown?.textBefore}
		<button type="button" class="kh-btn kh-btn--text" onclick={onresettext}>
			{fromClaude ? 'Som Claude skrev' : 'Texten som förut'}
		</button>
	{/if}
	{#if shown?.amountEdited}
		<button type="button" class="kh-btn kh-btn--text" onclick={onreset}>
			{fromClaude ? 'Som Claude räknade' : 'Mängden som förut'}
		</button>
	{/if}
	<button type="submit" form="item-form" class="kh-btn kh-btn--primary save">Spara</button>
{/snippet}

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--kh-space-m);
	}

	.amount {
		display: flex;
		align-items: center;
		gap: var(--kh-space-s);
	}

	.amount .kh-field {
		flex: 1;
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

	.kh-sheet__footer {
		flex-wrap: wrap;
	}

	.save {
		margin-inline-start: auto;
	}
</style>
