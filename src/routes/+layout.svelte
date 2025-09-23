<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import darkLogoUrl from '$lib/assets/dark-logo.png';
	import lightLogoUrl from '$lib/assets/light-logo.png';
	import { initializeTheme } from '$lib/theme';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		const cleanup = initializeTheme();
		return cleanup;
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('/favicon-dark.ico')} media="(prefers-color-scheme: light)" />
	<link rel="icon" href={asset('/favicon-light.ico')} media="(prefers-color-scheme: dark)" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<title>VelociView</title>
	<meta
		name="description"
		content="VelociView — customizable Strava‑style activity stats generator. Create clean overlays from your photo + TCX."
	/>
</svelte:head>

<div class="flex min-h-dvh flex-col text-foreground">
	<header class="container py-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight">
				<a href={resolve('/')} class="inline-flex items-center">
					<img src={darkLogoUrl} alt="" class="logo-light h-8 w-auto" aria-hidden="true" />
					<img src={lightLogoUrl} alt="" class="logo-dark h-8 w-auto" aria-hidden="true" />
					<span class="sr-only">VelociView</span>
				</a>
			</h1>
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

<style>
	:global(.logo-dark) {
		display: none;
	}
	:global([data-theme='dark']) :global(.logo-light) {
		display: none;
	}
	:global([data-theme='dark']) :global(.logo-dark) {
		display: inline;
	}
</style>
