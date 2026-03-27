<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'bordered' | 'elevated' | 'flat';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'default',
		padding = 'md',
		class: className = '',
		children
	}: Props = $props();

	const variantClasses = $derived(() => {
		const variants = {
			default: 'bg-white dark:bg-gray-800',
			bordered: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
			elevated: 'bg-white dark:bg-gray-800 shadow-md',
			flat: 'bg-transparent'
		};
		return variants[variant];
	});

	const paddingClasses = $derived(() => {
		const paddings = {
			none: '',
			sm: 'p-4',
			md: 'p-6',
			lg: 'p-8'
		};
		return paddings[padding];
	});

	const baseClasses = 'rounded-lg transition-all duration-200';
	const combinedClasses = $derived(`${baseClasses} ${variantClasses()} ${paddingClasses()} ${className}`);
</script>

<div class={combinedClasses}>
	{@render children()}
</div>
