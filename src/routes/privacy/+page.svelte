<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy — VelociView</title>
	<meta name="description" content="VelociView Privacy Policy." />
</svelte:head>

<section class="mx-auto max-w-prose">
	<h2 class="mb-4 text-xl font-semibold tracking-tight">Privacy Policy</h2>
	<p class="text-muted-foreground mb-3 text-sm">Last updated: 20 September 2025</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Overview</h3>
	<p class="mb-3">
		VelociView is designed with privacy in mind. Processing happens locally in your browser; by
		default, your files are not sent to a server by this application.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Data You Provide</h3>
	<p class="mb-3">
		When you upload a <code>.tcx</code> file, the data is parsed in your browser to compute stats and
		generate an image overlay. The file contents and derived stats are not transmitted to a server by
		this app.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">What We Do Not Collect</h3>
	<ul class="mb-3 list-disc space-y-1 pl-5">
		<li>No account information.</li>
		<li>No raw workout files or derived workout stats.</li>
		<li>No precise location data from your activities.</li>
	</ul>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Optional Third‑Party Services</h3>
	<p class="mb-3">
		This site may load fonts from Google Fonts to improve appearance. When used, your browser will
		request assets from Google’s CDN, which may receive standard request metadata (for example, IP
		address and user‑agent). You can block external fonts; the site will fall back to system fonts.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Analytics</h3>
	<p class="mb-3">
		No personal analytics are collected by default. If lightweight, anonymized analytics are enabled
		in the future, this policy will be updated before collection begins.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Security</h3>
	<p class="mb-3">
		Although no server‑side storage is used for your files, you should only use VelociView on
		devices you trust and keep your browser up to date.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Your Choices</h3>
	<ul class="mb-3 list-disc space-y-1 pl-5">
		<li>Use the tool without uploading sensitive activities.</li>
		<li>Disable external fonts to avoid third‑party font requests.</li>
	</ul>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Changes to this Policy</h3>
	<p class="mb-3">
		We may update this Privacy Policy from time to time. Material changes will be reflected by
		updating the date above.
	</p>

	<p class="mb-3">
		For related terms, see our <a class="underline" href={resolve('/terms')}>Terms of Service</a>.
	</p>

	<p>If you have questions about privacy, please contact the project maintainer.</p>
</section>
