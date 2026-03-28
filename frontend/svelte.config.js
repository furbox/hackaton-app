import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Static compilerOptions — applies to all files.
	// Previously this was a dynamicCompileOptions callback returning a new object
	// on every file compilation, which prevented the Svelte compiler from caching
	// and forced a full recompile on every HMR cycle.
	compilerOptions: { runes: true },
	kit: { adapter: adapter() }
};

export default config;
