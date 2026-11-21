import { getContext, onDestroy, setContext } from 'svelte';

// The main button beside the tabs at the bottom (web-ui's kh-toolbar__action). The layout shows it,
// so it sits in the same place in every view, and a view gives it its main action (#86, #174).

const key = Symbol('toolbar-action');

/** A link (`href`) or a button (`onclick`), with the name a screen reader and a tooltip give it. */
export type ToolbarAction =
	{ label: string; href: string } | { label: string; onclick: () => void };

type Slot = { current?: ToolbarAction };

/** Called by the layout, which renders `current` as the toolbar's main button. */
export function provideToolbarAction(): Slot {
	const slot = $state<Slot>({});
	setContext(key, slot);
	return slot;
}

/** Called by a view with its main action, which shows while the view is open. */
export function useToolbarAction(action: ToolbarAction) {
	const slot = getContext<Slot>(key);
	slot.current = action;
	// The next view may already have put its own action there.
	onDestroy(() => {
		if (slot.current === action) slot.current = undefined;
	});
}
