// web-ui's test helper for D-3 is plain JavaScript without types.
declare module '@kodhast/web-ui/prov.js' {
	import type { Page } from '@playwright/test';
	export function assertSinglePrimaryAction(page: Page): Promise<void>;
}
