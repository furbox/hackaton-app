<script lang="ts">
	interface Props {
		rank: string;
		variant?: 'default' | 'success' | 'warning' | 'info';
		size?: 'sm' | 'md';
	}

	let { rank, variant = 'default', size = 'md' }: Props = $props();

	const rankColors: Record<string, { bg: string; text: string }> = {
		newbie: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
		user: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
		admin: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' }
	};

	const colors = $derived(rankColors[rank.toLowerCase()] || rankColors.newbie);
	const sizeClasses = $derived(
		size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium'
	);
	const rankDisplay = $derived(rank.charAt(0).toUpperCase() + rank.slice(1).toLowerCase());
</script>

<span class="inline-flex items-center rounded-full {colors.bg} {colors.text} {sizeClasses}">
	{rankDisplay}
</span>
