<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  type Period = 'day' | 'week' | 'month' | 'year' | 'all';
  type Metric = 'views' | 'likes' | 'saves';

  interface TopLink {
    id: number;
    name: string;
    short_code: string;
    short_url: string;
    username: string;
    count: number;
    created_at: string;
  }

  interface StatsData {
    period: Period;
    metric: Metric;
    top_links: TopLink[];
  }

  let selectedPeriod: Period = 'all';
  let selectedMetric: Metric = 'views';
  let stats: StatsData | null = null;
  let loading = true;
  let error = '';

  const periods: { value: Period; label: string }[] = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' },
  ];

  const metrics: { value: Metric; label: string }[] = [
    { value: 'views', label: 'Views' },
    { value: 'likes', label: 'Likes' },
    { value: 'saves', label: 'Saves' },
  ];

  async function loadStats() {
    loading = true;
    error = '';
    try {
      const response = await api.get<{ data: StatsData }>(
        `/api/stats/top?period=${selectedPeriod}&metric=${selectedMetric}`
      );
      stats = response.data;
    } catch (err: any) {
      error = err.message || 'Failed to load stats';
    } finally {
      loading = false;
    }
  }

  function handlePeriodChange(period: Period) {
    selectedPeriod = period;
    loadStats();
  }

  function handleMetricChange(metric: Metric) {
    selectedMetric = metric;
    loadStats();
  }

  onMount(() => {
    loadStats();
  });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900">Public Stats</h1>
    <p class="mt-1 text-sm text-gray-600">Top performing links on the platform</p>
  </div>

  <div class="bg-white shadow rounded-lg p-6 mb-6">
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Period</label>
        <div class="flex flex-wrap gap-2">
          {#each periods as period}
            <button
              on:click={() => handlePeriodChange(period.value)}
              class="px-4 py-2 rounded-md font-medium transition-colors {selectedPeriod === period.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              {period.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Metric</label>
        <div class="flex flex-wrap gap-2">
          {#each metrics as metric}
            <button
              on:click={() => handleMetricChange(metric.value)}
              class="px-4 py-2 rounded-md font-medium transition-colors {selectedMetric === metric.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              {metric.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading stats...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-red-800">{error}</p>
    </div>
  {:else if stats && stats.top_links.length === 0}
    <div class="text-center py-12 bg-gray-50 rounded-lg">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No stats yet</h3>
      <p class="mt-1 text-sm text-gray-500">No links found for the selected period and metric.</p>
    </div>
  {:else if stats}
    <div class="bg-white shadow rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Link Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creator
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {selectedMetric === 'views' ? 'Views' : selectedMetric === 'likes' ? 'Likes' : 'Saves'}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Short URL
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each stats.top_links as link, index}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    {#if index === 0}
                      <span class="text-2xl">🥇</span>
                    {:else if index === 1}
                      <span class="text-2xl">🥈</span>
                    {:else if index === 2}
                      <span class="text-2xl">🥉</span>
                    {:else}
                      <span class="text-sm font-medium text-gray-900">#{index + 1}</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{link.name}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <a href="/users/{link.username}" class="text-sm text-blue-600 hover:text-blue-800">
                    @{link.username}
                  </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-bold text-gray-900">{link.count.toLocaleString()}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <a
                    href={link.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-blue-600 hover:text-blue-800 font-mono"
                  >
                    /{link.short_code}
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
