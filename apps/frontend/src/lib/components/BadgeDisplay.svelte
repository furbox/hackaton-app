<script lang="ts">
  import type { BadgeType } from '$lib/api';

  export let rank: BadgeType;
  export let badges: Array<{ badge_type: BadgeType; earned_at: string }> = [];
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showAllBadges = false;

  const badgeConfig: Record<
    BadgeType,
    { color: string; icon: string; label: string; bgColor: string; textColor: string }
  > = {
    iron: {
      color: 'gray',
      icon: '🔩',
      label: 'Iron',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
    },
    bronze: {
      color: 'orange',
      icon: '🥉',
      label: 'Bronze',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
    },
    silver: {
      color: 'slate',
      icon: '🥈',
      label: 'Silver',
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-800',
    },
    gold: {
      color: 'yellow',
      icon: '🥇',
      label: 'Gold',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
    },
    diamond: {
      color: 'cyan',
      icon: '💎',
      label: 'Diamond',
      bgColor: 'bg-cyan-100',
      textColor: 'text-cyan-800',
    },
  };

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      icon: 'text-base',
      allBadges: 'text-xs px-2 py-1',
    },
    md: {
      container: 'px-3 py-2 text-sm',
      icon: 'text-xl',
      allBadges: 'text-sm px-3 py-2',
    },
    lg: {
      container: 'px-4 py-3 text-base',
      icon: 'text-2xl',
      allBadges: 'text-base px-4 py-3',
    },
  };

  $: currentBadge = badgeConfig[rank];
  $: earnedBadges = badges.map((b) => b.badge_type);
</script>

<div class="inline-flex flex-col gap-2">
  <div class="inline-flex items-center gap-2">
    <div
      class="inline-flex items-center gap-2 rounded-full font-bold transition-all {currentBadge.bgColor} {currentBadge.textColor} {sizeClasses[size].container}"
    >
      <span class="{sizeClasses[size].icon}">{currentBadge.icon}</span>
      <span>{currentBadge.label}</span>
    </div>
  </div>

  {#if showAllBadges && badges.length > 0}
    <div class="flex flex-wrap gap-2 mt-2">
      {#each badges as badge}
        {@const badgeInfo = badgeConfig[badge.badge_type]}
        <div
          class="inline-flex items-center gap-1 rounded-md font-medium {badgeInfo.bgColor} {badgeInfo.textColor} {sizeClasses[size].allBadges}"
          title="Earned on {new Date(badge.earned_at).toLocaleDateString()}"
        >
          <span>{badgeInfo.icon}</span>
          <span>{badgeInfo.label}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
