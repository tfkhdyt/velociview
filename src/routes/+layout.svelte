<script lang="ts">
	import { resolve } from '$app/paths';
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

<div class="flex min-h-dvh flex-col text-foreground transition-colors duration-300">
	<header class="container py-6">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-semibold tracking-tight">VelociView</h1>
			<nav aria-label="Header" class="flex gap-x-6 text-sm">
				<a href={resolve('/')} class="hover:underline">Home</a>
				<a href={resolve('/about')} class="hover:underline">About</a>
			</nav>
		</div>
	</header>
	<main class="container flex-1 pb-10">
		{@render children?.()}
	</main>
	<footer class="container border-t py-6">
		<nav
			aria-label="Footer"
			class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm sm:justify-start sm:text-left"
		>
			<a href={resolve('/terms')} class="hover:underline">Terms of Service</a>
			<a href={resolve('/privacy')} class="hover:underline">Privacy Policy</a>
			<a href="https://github.com/tfkhdyt/velociview" target="_blank" class="hover:underline"
				>Source Code</a
			>
		</nav>
	</footer>
</div>
