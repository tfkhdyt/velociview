<script lang="ts">
	import { Copy as CopyIcon, Download, RotateCcw, Share2 } from '@lucide/svelte';
	let {
		canExport,
		canCopy,
		canShare,
		copying,
		sharing,
		justCopied,
		onExportClick,
		onCopyClick,
		onShareClick,
		onResetClick
	}: {
		canExport: boolean;
		canCopy: boolean;
		canShare: boolean;
		copying: boolean;
		sharing: boolean;
		justCopied: boolean;
		onExportClick: () => void;
		onCopyClick: () => void;
		onShareClick: () => void;
		onResetClick: () => void;
	} = $props();

	function handleResetClick(): void {
		if (confirm('Reset all settings and clear data?')) {
			onResetClick();
		}
	}
</script>

<div class="flex flex-wrap items-center gap-3">
	<button class="btn btn-primary" onclick={onExportClick} disabled={!canExport}>
		<span class="inline-flex items-center gap-2">
			<Download class="h-4 w-4" aria-hidden="true" />
			Export
		</span>
	</button>

	{#if canShare}
		<button
			class="btn btn-secondary"
			onclick={onShareClick}
			disabled={!canShare || sharing}
			title={canShare ? 'Share the image' : 'Sharing not supported on this device'}
		>
			{#if sharing}
				<span class="inline-flex items-center gap-2">
					<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
						></path>
					</svg>
					Sharing…
				</span>
			{:else}
				<span class="inline-flex items-center gap-2">
					<Share2 class="h-4 w-4" aria-hidden="true" />
					Share
				</span>
			{/if}
		</button>
	{/if}

	<button
		class="btn btn-secondary"
		onclick={onCopyClick}
		disabled={!canCopy || copying}
		title={canCopy ? 'Copy the image to clipboard' : 'Clipboard not supported'}
	>
		{#if copying}
			<span class="inline-flex items-center gap-2">
				<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
					></path>
				</svg>
				Copying…
			</span>
		{:else if justCopied}
			Copied!
		{:else}
			<span class="inline-flex items-center gap-2">
				<CopyIcon class="h-4 w-4" aria-hidden="true" />
				Copy
			</span>
		{/if}
	</button>

	<button class="btn btn-ghost" onclick={handleResetClick}>
		<span class="inline-flex items-center gap-2">
			<RotateCcw class="h-4 w-4" aria-hidden="true" />
			Reset
		</span>
	</button>
</div>
