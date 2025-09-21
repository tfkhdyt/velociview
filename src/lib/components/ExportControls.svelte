<script lang="ts">
	let {
		exportFormat,
		exportQuality,
		onChange
	}: {
		exportFormat: 'png' | 'jpeg' | 'webp';
		exportQuality: number;
		onChange: (params: { exportFormat: 'png' | 'jpeg' | 'webp'; exportQuality: number }) => void;
	} = $props();

	function updateFormat(value: 'png' | 'jpeg' | 'webp'): void {
		onChange({ exportFormat: value, exportQuality });
	}
	function updateQuality(value: number): void {
		onChange({ exportFormat, exportQuality: value });
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Export</h3>
	<div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
		<label class="block text-sm">
			<span class="form-label">Format</span>
			<select
				bind:value={exportFormat}
				class="form-control"
				onchange={(e) =>
					updateFormat((e.target as HTMLSelectElement).value as 'png' | 'jpeg' | 'webp')}
			>
				<option value="png">PNG (lossless)</option>
				<option value="jpeg">JPEG (lossy)</option>
				<option value="webp">WebP (lossy/lossless)</option>
			</select>
		</label>
		{#if exportFormat !== 'png'}
			<label class="block text-sm">
				<span class="form-label">Quality</span>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0.4"
						max="1"
						step="0.01"
						bind:value={exportQuality}
						oninput={(e) => updateQuality(Number((e.target as HTMLInputElement).value))}
						class="form-range"
					/>
					<input
						type="number"
						min="0.4"
						max="1"
						step="0.01"
						bind:value={exportQuality}
						oninput={(e) => updateQuality(Number((e.target as HTMLInputElement).value))}
						class="form-control w-20"
					/>
				</div>
			</label>
		{/if}
	</div>
</div>
