<script lang="ts">
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import ProfileLinks from '$lib/components/profile/ProfileLinks.svelte';

	let { data } = $props<{
		user: {
			id: number;
			username: string;
			name: string | null;
			bio: string | null;
			avatarUrl: string | null;
			rank: string;
			stats: {
				totalLinks: number;
				totalLikes: number;
				totalViews: number;
			};
			links: any[];
		};
	}>();

	// Add default values for safety
	const user = $derived(data?.user ?? {
		id: 0,
		username: 'Unknown',
		name: null,
		bio: null,
		avatarUrl: null,
		rank: 'newbie',
		stats: { totalLinks: 0, totalLikes: 0, totalViews: 0 },
		links: []
	});
</script>

<svelte:head>
	<title>{user.username} - URLoft</title>
	<meta
		name="description"
		content={user.bio || `Perfil de ${user.name || user.username} en URLoft`}
	/>
	<meta property="og:title" content={user.username} />
	<meta
		property="og:description"
		content={user.bio || `Perfil de ${user.name || user.username} en URLoft`}
	/>
	<meta property="og:image" content={user.avatarUrl || '/default-avatar.png'} />
	<meta property="og:type" content="profile" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Profile Header -->
	<ProfileHeader user={user} />

	<!-- Profile Links -->
	<div class="mt-8">
		<ProfileLinks links={user.links} />
	</div>
</div>
