<script lang="ts">
	// web-ui's snackbar (kh-snackbar, AppSnackbarHost): one line that goes by itself after a while,
	// with an action such as Ångra. onclose says whether the action was taken. A duration of 0 keeps
	// it until the action is taken.
	let {
		text,
		action,
		duration = 6000,
		onclose
	}: {
		text: string;
		action?: string;
		duration?: number;
		onclose: (actionTaken: boolean) => void;
	} = $props();

	let closed = false;
	function close(actionTaken: boolean) {
		if (closed) return;
		closed = true;
		onclose(actionTaken);
	}

	$effect(() => {
		if (duration === 0) return;
		const timer = setTimeout(() => close(false), duration);
		return () => clearTimeout(timer);
	});
</script>

<div class="kh-snackbar-host">
	<div class="kh-snackbar" role="status">
		<span class="kh-snackbar__text">{text}</span>
		{#if action}
			<button type="button" class="kh-snackbar__action" onclick={() => close(true)}>
				{action}
			</button>
		{/if}
	</div>
</div>
