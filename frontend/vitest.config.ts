import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				// Use svelte() directly — NOT sveltekit(). sveltekit() starts FS watchers
				// (chokidar polling on Windows) that leak memory during `vite dev`.
				plugins: [svelte({ compilerOptions: { runes: true } })],
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				// Server tests — no Svelte plugin needed, plain Node environment.
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
