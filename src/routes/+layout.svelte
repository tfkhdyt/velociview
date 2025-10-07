<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import darkLogoUrl from '$lib/assets/dark-logo.png';
	import lightLogoUrl from '$lib/assets/light-logo.png';
	import { initializeTheme } from '$lib/theme';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	const siteName: string = 'VelociView';
	const defaultTitle: string = 'VelociView';
	const defaultDescription: string =
		'VelociView — customizable Strava‑style activity stats generator. Create clean overlays from your photo + GPX.';
	const origin = $derived(page.url.origin);
	const canonicalUrl: string = $derived.by(() => {
		return origin + page.url.pathname;
	});
	const ogImageAbsoluteUrl: string = $derived.by(() => {
		return origin + asset('/preview.jpg');
	});

	const websiteJsonLd: string = $derived.by(() => {
		const data = {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': `${canonicalUrl}#website`,
			url: origin + '/',
			name: siteName,
			inLanguage: 'en',
			publisher: {
				'@type': 'Organization',
				name: siteName,
				url: origin + '/',
				sameAs: ['https://github.com/tfkhdyt/velociview']
			}
		};

		return JSON.stringify(data);
	});

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
	<title>{defaultTitle}</title>
	<meta name="description" content={defaultDescription} />
	<link rel="canonical" href={canonicalUrl} />

	<!-- Open Graph -->
	<meta property="og:site_name" content={siteName} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content={defaultTitle} />
	<meta property="og:description" content={defaultDescription} />
	<meta property="og:image" content={ogImageAbsoluteUrl} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={defaultTitle} />
	<meta name="twitter:description" content={defaultDescription} />
	<meta name="twitter:image" content={ogImageAbsoluteUrl} />

	<!-- Theme color for light/dark -->
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0b0b" />

	<!-- JSON-LD -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${websiteJsonLd}<` + `/script>`}
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
