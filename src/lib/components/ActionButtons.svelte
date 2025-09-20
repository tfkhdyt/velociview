<script lang="ts">
	let {
		canExport,
		canCopy,
		copying,
		justCopied,
		onExportClick,
		onCopyClick,
		onResetClick
	}: {
		canExport: boolean;
		canCopy: boolean;
		copying: boolean;
		justCopied: boolean;
		onExportClick: () => void;
		onCopyClick: () => void;
		onResetClick: () => void;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-3">
	<button class="btn btn-primary" onclick={onExportClick} disabled={!canExport}>Export</button>

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
			Copy
		{/if}
	</button>

	<button class="btn btn-ghost" onclick={onResetClick}>Reset</button>
</div>
