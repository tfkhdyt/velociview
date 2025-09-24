<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';

	const origin = $derived(page.url.origin);
	const canonicalUrl: string = $derived.by(() => {
		return origin + page.url.pathname;
	});
	const ogImageAbsoluteUrl: string = $derived.by(() => {
		return origin + asset('/preview.jpg');
	});
</script>

<svelte:head>
	<title>About — VelociView</title>
	<meta
		name="description"
		content="What VelociView is, how it works, and what you need to use it."
	/>
	<meta property="og:site_name" content="VelociView" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content="About — VelociView" />
	<meta
		property="og:description"
		content="What VelociView is, how it works, and what you need to use it."
	/>
	<meta property="og:image" content={ogImageAbsoluteUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="About — VelociView" />
	<meta
		name="twitter:description"
		content="What VelociView is, how it works, and what you need to use it."
	/>
	<meta name="twitter:image" content={ogImageAbsoluteUrl} />
</svelte:head>

<section class="mx-auto max-w-prose">
	<h2 class="mb-4 text-xl font-semibold tracking-tight">About</h2>
	<p class="mb-3">
		VelociView is a customizable Strava‑style activity statistics generator. It helps you turn your
		workouts into clean, shareable visuals by extracting key metrics from your TCX files and
		composing them into a polished overlay that matches your style.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">What it does</h3>
	<p class="mb-3">
		Upload a <code>.tcx</code> activity file and choose which stats to show (for example: distance, moving
		time, average/max speed, pace, elevation gain/loss). Then adjust layout and appearance to match your
		photo or brand, and export a high‑quality image you can post anywhere.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">How it works</h3>
	<ol class="mb-3 list-decimal space-y-1 pl-5">
		<li>Upload your image and <code>.tcx</code> file.</li>
		<li>Select the fields you want to include.</li>
		<li>Pick a layout: list, auto grid, or fixed columns; tune spacing/columns.</li>
		<li>Customize appearance: font, scale, backdrop darkness, and alignment.</li>
		<li>
			Export as <strong>PNG</strong>, <strong>JPEG</strong>, or <strong>WebP</strong> (with quality control
			for JPEG/WebP).
		</li>
	</ol>

	<h3 class="mb-2 text-base font-semibold tracking-tight">What is a TCX file?</h3>
	<p class="mb-3">
		A <code>.tcx</code> (Training Center XML) file is a common workout data format containing GPS tracks
		and activity stats like distance, time, pace/speed, and elevation. Many fitness apps and devices
		can export your activity as TCX.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Where to get a TCX</h3>
	<ul class="mb-3 list-disc space-y-1 pl-5">
		<li>
			<strong>Strava</strong>: Open an activity → <em>...</em> menu → <em>Export TCX</em>.
		</li>
		<li>
			<strong>Garmin Connect</strong>: Activity page → <em>Gear</em> icon → <em>Export as TCX</em>.
		</li>
		<li>
			<strong>Wahoo</strong> / <strong>Polar</strong> / others: Activity details → export/download →
			choose
			<em>TCX</em>.
		</li>
	</ul>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Requirements</h3>
	<ul class="mb-3 list-disc space-y-1 pl-5">
		<li>A valid <code>.tcx</code> activity file exported from your fitness tracker/app.</li>
		<li>
			A modern desktop or mobile browser (Chrome, Edge, Firefox, Safari) with JavaScript enabled.
		</li>
		<li>Optional: Internet access to load Google Fonts. Without it, a system font will be used.</li>
	</ul>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Privacy</h3>
	<p class="mb-3">
		Processing happens locally in your browser; your files are not uploaded to a server by this app.
		See the
		<a class="underline" href={resolve(`/privacy`)}>Privacy Policy</a>
		for details.
	</p>

	<p>This project is open source. Feedback and contributions are welcome.</p>
</section>
