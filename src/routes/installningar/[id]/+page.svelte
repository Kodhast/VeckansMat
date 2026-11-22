<script lang="ts">
	import { enhance } from '$app/forms';
	import FormHeader from '#lib/FormHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// After a failed save the form shows what was written, not what is stored.
	let values = $derived(form?.values ?? data.person ?? { name: '', requirements: '' });

	// A person is removed for good, so the dialog asks first (android-ui #118).
	let question: HTMLDialogElement | undefined = $state();
	let deleteForm: HTMLFormElement | undefined = $state();
	function answer() {
		if (question?.returnValue === 'delete') deleteForm?.requestSubmit();
	}
</script>

<svelte:head>
	<title>{data.person?.name ?? 'Ny person'} – Veckans mat</title>
</svelte:head>

<form method="POST" action="?/save" class="form-page" use:enhance>
	<FormHeader title={data.person?.name ?? 'Ny person'} back="/installningar" />

	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	<label class="kh-field">
		<input
			class="kh-field__input"
			id="name"
			name="name"
			required
			autocomplete="off"
			placeholder=" "
			value={values.name}
		/>
		<span class="kh-field__label">Namn</span>
	</label>
	<label class="kh-field">
		<textarea
			class="kh-field__input"
			id="requirements"
			name="requirements"
			rows="4"
			placeholder=" "
			value={values.requirements}></textarea>
		<span class="kh-field__label">Krav: allergier, kost, sådant hen inte äter</span>
	</label>
	<p class="note">
		Gäller de veckor personen äter med. Allergier och det hen inte äter följer Claude alltid, det
		andra när det går.
	</p>
</form>

{#if data.person}
	<form bind:this={deleteForm} method="POST" action="?/delete" class="form-page delete" use:enhance>
		<button
			type="button"
			class="kh-btn kh-btn--destructive-text"
			onclick={() => {
				// Escape leaves the last answer, so a new question starts without one.
				if (!question) return;
				question.returnValue = '';
				question.showModal();
			}}
		>
			Radera {data.person.name}
		</button>
	</form>

	<dialog bind:this={question} class="kh-dialog" aria-labelledby="delete-question" onclose={answer}>
		<h2 id="delete-question" class="kh-dialog__title">Radera {data.person.name}?</h2>
		<p class="kh-dialog__text">
			{data.person.name} och kraven tas bort för gott.
		</p>
		<form method="dialog" class="kh-dialog__actions">
			<button class="kh-btn kh-btn--text" value="">Avbryt</button>
			<button class="kh-btn kh-btn--destructive-text" value="delete">Radera</button>
		</form>
	</dialog>
{/if}

<style>
	.delete {
		align-items: center;
	}

	textarea {
		min-block-size: 6rem;
	}
</style>
