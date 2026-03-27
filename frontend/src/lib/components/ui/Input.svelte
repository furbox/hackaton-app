<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'number' | 'tel';
		name?: string;
		id?: string;
		placeholder?: string;
		value?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		minlength?: number;
		maxlength?: number;
		pattern?: string;
		class?: string;
		label?: string;
		error?: string;
		hint?: string;
		oninput?: (value: string) => void;
		onchange?: (value: string) => void;
		onfocus?: () => void;
		onblur?: () => void;
	}

	let {
		type = 'text',
		name,
		id,
		placeholder,
		value,
		required = false,
		disabled = false,
		readonly = false,
		minlength,
		maxlength,
		pattern,
		class: className = '',
		label,
		error,
		hint,
		oninput,
		onchange,
		onfocus,
		onblur
	}: Props = $props();

	// Local reactive state for two-way binding when value is not provided
	let localValue = $state('');
	const boundValue = $derived(value !== undefined ? value : localValue);
	const inputId = $derived(id || name || `input-${Math.random().toString(36).slice(2, 11)}`);

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const newValue = target.value;
		if (value === undefined) {
			localValue = newValue;
		}
		oninput?.(newValue);
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange?.(target.value);
	}

	const hasError = $derived(!!error);
	const baseClasses =
		'w-full px-3 py-2 text-sm rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';
	const stateClasses = $derived(
		hasError
			? 'border-red-500 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500 dark:text-red-100 dark:placeholder-red-400 dark:bg-red-900/20 dark:focus:ring-red-400'
			: 'border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-primary focus:border-primary dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 dark:bg-gray-700 dark:focus:ring-primary'
	);
	const combinedClasses = $derived(`${baseClasses} ${stateClasses} ${className}`);
</script>

<div class="w-full">
	{#if label}
		<label for={inputId} class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
			{label}
			{#if required}
				<span class="text-red-500 ml-1" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<input
		id={inputId}
		name={name}
		{type}
		{placeholder}
		{required}
		{disabled}
		{readonly}
		{minlength}
		{maxlength}
		{pattern}
		class={combinedClasses}
		value={boundValue}
		oninput={handleInput}
		onchange={handleChange}
		onfocus={onfocus}
		onblur={onblur}
	/>

	{#if error}
		<p class="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
			{error}
		</p>
	{:else if hint}
		<p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
			{hint}
		</p>
	{/if}
</div>
