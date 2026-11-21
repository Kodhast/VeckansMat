<script lang="ts">
	import { BASES, CATEGORIES } from './recipes';

	// The fields of a recipe, shared by the form that edits one and the one that adds one, in web-ui's
	// fields and chips. Only the form that edits one has the sort and base, with a word on whether
	// Claude guessed them.
	let {
		values,
		lunchbox,
		sort
	}: { values: Record<string, string>; lunchbox: boolean; sort?: { guessed: boolean } } = $props();

	const groups = [
		{ name: 'category', legend: 'Sort', choices: CATEGORIES },
		{ name: 'base', legend: 'Bas', choices: BASES }
	] as const;

	// The chosen sort and base, which the chips show; the radio buttons send them with the form.
	// They start over when the form's values do.
	let chosen = $derived.by(() => {
		const choice = $state<Record<string, string>>({
			category: values.category ?? '',
			base: values.base ?? ''
		});
		return choice;
	});
</script>

<section class="kh-card">
	<label class="kh-field">
		<input
			class="kh-field__input"
			id="name"
			name="name"
			required
			placeholder=" "
			value={values.name}
		/>
		<span class="kh-field__label">Namn</span>
	</label>
	{#if sort}
		{#each groups as group (group.name)}
			<fieldset aria-describedby="sort-hint">
				<legend>{group.legend}</legend>
				<div class="kh-chips">
					{#each group.choices as choice (choice.key)}
						<label class={['kh-chip', chosen[group.name] === choice.key && 'kh-chip--selected']}>
							<input
								type="radio"
								name={group.name}
								value={choice.key}
								bind:group={chosen[group.name]}
							/>
							<span class="kh-chip__label">{choice.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/each}
		<p class="hint" id="sort-hint">
			{sort.guessed
				? 'Claude gissade sort och bas. Välj något annat om det blev fel.'
				: 'Det du väljer här ändrar Claude aldrig.'}
		</p>
	{/if}
</section>
<section class="kh-card pair">
	<label class="kh-field">
		<input
			class="kh-field__input"
			id="servings"
			name="servings"
			inputmode="numeric"
			placeholder=" "
			value={values.servings}
		/>
		<span class="kh-field__label">Portioner</span>
	</label>
	<label class="kh-field">
		<input
			class="kh-field__input"
			id="timeMinutes"
			name="timeMinutes"
			inputmode="numeric"
			placeholder=" "
			value={values.timeMinutes}
		/>
		<span class="kh-field__label">Tid i minuter</span>
	</label>
</section>
<!-- The heading is part of the field's name, so a screen reader says what the field is for. -->
<section class="kh-card">
	<h2 id="ingredients-heading">Ingredienser</h2>
	<label class="kh-field">
		<textarea
			class="kh-field__input"
			id="ingredients"
			name="ingredients"
			rows="4"
			placeholder=" "
			aria-labelledby="ingredients-heading ingredients-label"
			value={values.ingredients}></textarea>
		<span class="kh-field__label" id="ingredients-label">En per rad</span>
	</label>
</section>
<section class="kh-card">
	<h2 id="instructions-heading">Gör så här</h2>
	<label class="kh-field">
		<textarea
			class="kh-field__input"
			id="instructions"
			name="instructions"
			rows="3"
			placeholder=" "
			aria-labelledby="instructions-heading instructions-label"
			value={values.instructions}></textarea>
		<span class="kh-field__label" id="instructions-label">Ett steg per rad eller stycke</span>
	</label>
</section>
<section class="kh-card">
	<h2>Mer</h2>
	<label class="kh-row kh-switch-row">
		<span class="kh-row__text"><span class="kh-row__title">Passar till matlådor</span></span>
		<input
			type="checkbox"
			role="switch"
			class="kh-switch"
			id="lunchbox"
			name="lunchbox"
			checked={lunchbox}
		/>
	</label>
	<label class="kh-field">
		<input class="kh-field__input" id="tags" name="tags" placeholder=" " value={values.tags} />
		<span class="kh-field__label">Taggar, med komma emellan</span>
	</label>
	<label class="kh-field">
		<input
			class="kh-field__input"
			id="sourceUrl"
			name="sourceUrl"
			type="url"
			placeholder=" "
			value={values.sourceUrl}
		/>
		<span class="kh-field__label">Länk till receptet</span>
	</label>
</section>

<style>
	fieldset {
		margin: var(--kh-space-xs) 0 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: var(--kh-space-s);
		padding: 0;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	/* The radio button is the chip itself. */
	.kh-chip input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.kh-chip:has(:focus-visible) {
		outline: 2px solid var(--kh-primary);
		outline-offset: 2px;
	}

	/* web-ui's field grows with its text and leaves rows aside, so a recipe gets room to start in. */
	textarea {
		min-block-size: 6rem;
	}

	.hint {
		margin: 0;
		font: var(--kh-type-item-subtitle);
		color: var(--kh-on-surface-variant);
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--kh-space-m);
	}

	/* The row lies on the card's edge, as the fields do. */
	.kh-switch-row {
		padding-inline: 0;
	}
</style>
