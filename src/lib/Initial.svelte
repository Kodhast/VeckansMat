<script lang="ts">
	// The first letter of a list row's name in a shape, the shapes taking turns down the list.
	let { name, index }: { name: string; index: number } = $props();

	const SHAPES = ['round', 'square', 'leaf'];
</script>

<span class="initial {SHAPES[index % SHAPES.length]}" aria-hidden="true">{name[0]}</span>

<style>
	.initial {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}

	.round {
		border-radius: 50%;
		background: var(--kh-primary-container);
		color: var(--kh-on-primary-container);
	}

	.square {
		border-radius: 0.875rem;
		background: var(--kh-secondary-container);
		color: var(--kh-on-secondary-container);
	}

	.leaf {
		border-radius: 50% 50% 50% 0.75rem;
		background: var(--kh-surface-variant);
		color: var(--kh-on-surface);
	}
</style>
