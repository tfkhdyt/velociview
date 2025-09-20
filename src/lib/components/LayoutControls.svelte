<script lang="ts">
	let {
		gridMode,
		gridColumns,
		gridGapScale,
		maxColumns,
		onChange
	}: {
		gridMode: 'list' | 'auto' | 'fixed';
		gridColumns: number;
		gridGapScale: number;
		maxColumns: number;
		onChange: (params: {
			gridMode: 'list' | 'auto' | 'fixed';
			gridColumns: number;
			gridGapScale: number;
		}) => void;
	} = $props();

	function updateMode(value: 'list' | 'auto' | 'fixed'): void {
		onChange({ gridMode: value, gridColumns, gridGapScale });
	}
	function updateColumns(value: number): void {
		onChange({ gridMode, gridColumns: value, gridGapScale });
	}
	function updateGap(value: number): void {
		onChange({ gridMode, gridColumns, gridGapScale: value });
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Layout</h3>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<label class="block text-sm">
			<span class="form-label">Mode</span>
			<select
				bind:value={gridMode}
				class="form-control"
				onchange={(e) =>
					updateMode((e.target as HTMLSelectElement).value as 'list' | 'auto' | 'fixed')}
			>
				<option value="list">List</option>
				<option value="auto">Auto grid</option>
				<option value="fixed">Fixed columns</option>
			</select>
		</label>
		{#if gridMode === 'fixed'}
			<label class="block text-sm">
				<span class="form-label">Columns</span>
				<input
					type="number"
					min="1"
					max={Math.max(1, maxColumns)}
					step="1"
					bind:value={gridColumns}
					onchange={(e) => updateColumns(Number((e.target as HTMLInputElement).value))}
					class="form-control"
				/>
			</label>
		{/if}
		{#if gridMode !== 'list'}
			<label class="block text-sm">
				<span class="form-label">Grid spacing</span>
				<input
					type="range"
					min="0"
					max="4"
					step="0.05"
					bind:value={gridGapScale}
					oninput={(e) => updateGap(Number((e.target as HTMLInputElement).value))}
					class="form-range"
				/>
			</label>
		{/if}
	</div>
</div>
