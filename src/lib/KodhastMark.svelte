<script lang="ts">
	// Kodhäst's mark: the horse in the text's colour and the two dots in the theme's. The shape is
	// the profile's own and is not redrawn. Decoration only, so screen readers skip it.
	let { size = '1.5rem' }: { size?: string } = $props();
</script>

<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
	<polygon
		points="9,59 9,34 7,28 12,22 29,22 34,11 36,2 41,9 44,9 56,16 59,23 53,28 47,24 50,36 50,59 37,59 37,45 34,42 25,42 22,45 22,59"
		fill="currentColor"
	/>
	<circle cx="11.5" cy="10" r="3.6" fill="var(--md-sys-color-primary)" />
	<circle cx="22.5" cy="10" r="3.6" fill="var(--md-sys-color-primary)" />
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
