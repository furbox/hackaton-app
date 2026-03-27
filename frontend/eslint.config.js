import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$env/static/public',
							importNames: ['PUBLIC_BACKEND_URL'],
							message: 'Use proxy layer helpers for backend endpoint forwarding.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/routes/api/proxy/**/*.ts', 'src/lib/server/**/*.ts'],
		rules: {
			'no-restricted-imports': 'off'
		}
	},
	{
		files: ['src/routes/**/*.ts', 'src/hooks.server.ts'],
		ignores: ['src/routes/api/proxy/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "Literal[value=/^\\/api\\//]",
					message: 'Routes and hooks must call typed services, not hardcoded API endpoints.'
				}
			]
		}
	},
	{
		files: ['src/lib/services/**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "Literal[value=/^\\/api\\/(?!proxy\\/)/]",
					message: 'Services must call proxy-relative routes only.'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
