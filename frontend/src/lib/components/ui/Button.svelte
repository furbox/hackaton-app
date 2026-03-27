<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		class?: string;
		children: Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		type = 'button',
		variant = 'primary',
		size = 'md',
		disabled = false,
		class: className = '',
		children,
		onclick
	}: Props = $props();

	const variantClasses = $derived(() => {
		const variants = {
			primary:
				'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900',
			secondary:
				'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-900',
			danger:
				'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
			ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700'
		};
		return variants[variant];
	});

	const sizeClasses = $derived(() => {
		const sizes = {
			sm: 'px-3 py-1.5 text-sm font-medium',
			md: 'px-4 py-2 text-sm font-medium',
			lg: 'px-6 py-3 text-base font-medium'
		};
		return sizes[size];
	});

	const baseClasses =
		'inline-flex items-center justify-center rounded-md border border-transparent transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';
	const combinedClasses = $derived(`${baseClasses} ${variantClasses()} ${sizeClasses()} ${className}`);
</script>

<button
	{type}
	{disabled}
	class={combinedClasses}
	onclick={onclick}
>
	{@render children()}
</button>
