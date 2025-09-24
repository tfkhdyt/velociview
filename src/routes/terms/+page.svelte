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
	<title>Terms of Service — VelociView</title>
	<meta name="description" content="VelociView Terms of Service." />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:site_name" content="VelociView" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content="Terms of Service — VelociView" />
	<meta property="og:description" content="VelociView Terms of Service." />
	<meta property="og:image" content={ogImageAbsoluteUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Terms of Service — VelociView" />
	<meta name="twitter:description" content="VelociView Terms of Service." />
	<meta name="twitter:image" content={ogImageAbsoluteUrl} />
</svelte:head>

<section class="mx-auto max-w-prose">
	<h2 class="mb-4 text-xl font-semibold tracking-tight">Terms of Service</h2>
	<p class="text-muted-foreground mb-3 text-sm">Last updated: 20 September 2025</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Acceptance of Terms</h3>
	<p class="mb-3">
		By accessing or using VelociView (the "Service"), you agree to be bound by these Terms of
		Service. If you do not agree, do not use the Service.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Use of the Service</h3>
	<ul class="mb-3 list-disc space-y-1 pl-5">
		<li>You must have the rights necessary to upload and process any files you use.</li>
		<li>You may not misuse, disrupt, or attempt to interfere with the Service.</li>
		<li>The Service is provided for personal and non-commercial use unless otherwise agreed.</li>
	</ul>

	<h3 class="mb-2 text-base font-semibold tracking-tight">No Warranty</h3>
	<p class="mb-3">
		The Service is provided on an "as is" and "as available" basis, without warranties of any kind,
		express or implied, including but not limited to merchantability, fitness for a particular
		purpose, and non-infringement.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Limitation of Liability</h3>
	<p class="mb-3">
		To the maximum extent permitted by law, the maintainers and contributors are not liable for any
		direct, indirect, incidental, special, consequential, or exemplary damages resulting from your
		use or inability to use the Service.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Intellectual Property</h3>
	<p class="mb-3">
		VelociView and its source code are licensed as stated in the project's <strong>LICENSE</strong> file.
		This does not grant you rights to use any trademarks, logos, or brand elements except as permitted
		by applicable law.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">User Content</h3>
	<p class="mb-3">
		You retain rights to the content you upload. You are solely responsible for ensuring that your
		content and its processing comply with applicable laws and third-party terms.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Changes to the Service</h3>
	<p class="mb-3">
		Features may change, be added, or removed at any time without notice. The Service may be
		temporarily unavailable due to maintenance or technical issues.
	</p>

	<h3 class="mb-2 text-base font-semibold tracking-tight">Changes to these Terms</h3>
	<p class="mb-3">
		We may update these Terms periodically. Continued use of the Service after changes become
		effective constitutes acceptance of the updated Terms.
	</p>

	<p class="mb-3">
		For information about how we handle data, see our
		<a class="underline" href={resolve('/privacy')}>Privacy Policy</a>.
	</p>

	<p>If you have questions about these Terms, please contact the project maintainer.</p>
</section>
