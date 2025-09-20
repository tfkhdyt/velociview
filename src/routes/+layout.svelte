<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { initializeTheme } from '$lib/theme';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		initializeTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<title>VelociView</title>
	<meta name="description" content="VelociView — TCX image overlay generator for activity stats." />
</svelte:head>

<div class="min-h-dvh text-foreground transition-colors duration-300">
	<header class="container py-6">
		<h1 class="text-xl font-semibold tracking-tight">VelociView</h1>
	</header>
	<main class="container pb-10">
		{@render children?.()}
	</main>
</div>
