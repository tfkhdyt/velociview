<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About — VelociView</title>
	<meta
		name="description"
		content="What VelociView is, how it works, and what you need to use it."
	/>
</svelte:head>

<section class="mx-auto max-w-prose">
	<h2 class="mb-4 text-xl font-semibold tracking-tight">About</h2>
	<p class="mb-3">
		VelociView is a TCX image overlay generator for activity statistics. It helps you turn your
		workouts into clean, shareable visuals by extracting key metrics from your TCX files and
		composing them into a customizable overlay.
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
