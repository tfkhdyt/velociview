<script lang="ts">
	let {
		gridMode,
		gridColumns,
		gridGapX,
		gridGapY,
		maxColumns,
		onChange
	}: {
		gridMode: 'list' | 'auto' | 'fixed';
		gridColumns: number;
		gridGapX: number;
		gridGapY: number;
		maxColumns: number;
		onChange: (params: {
			gridMode: 'list' | 'auto' | 'fixed';
			gridColumns: number;
			gridGapX: number;
			gridGapY: number;
		}) => void;
	} = $props();

	function updateMode(value: 'list' | 'auto' | 'fixed'): void {
		onChange({ gridMode: value, gridColumns, gridGapX, gridGapY });
	}
	function updateColumns(value: number): void {
		onChange({ gridMode, gridColumns: value, gridGapX, gridGapY });
	}
	function updateGapX(value: number): void {
		onChange({ gridMode, gridColumns, gridGapX: value, gridGapY });
	}
	function updateGapY(value: number): void {
		onChange({ gridMode, gridColumns, gridGapX, gridGapY: value });
	}
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Layout</h3>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
				<span class="form-label">Horizontal spacing</span>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0"
						max="8"
						step="0.05"
						bind:value={gridGapX}
						oninput={(e) => updateGapX(Number((e.target as HTMLInputElement).value))}
						class="form-range"
					/>
					<input
						type="number"
						min="0"
						max="8"
						step="0.05"
						bind:value={gridGapX}
						oninput={(e) => updateGapX(Number((e.target as HTMLInputElement).value))}
						class="form-control w-20"
					/>
				</div>
			</label>
			<label class="block text-sm">
				<span class="form-label">Vertical spacing</span>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="0"
						max="8"
						step="0.05"
						bind:value={gridGapY}
						oninput={(e) => updateGapY(Number((e.target as HTMLInputElement).value))}
						class="form-range"
					/>
					<input
						type="number"
						min="0"
						max="8"
						step="0.05"
						bind:value={gridGapY}
						oninput={(e) => updateGapY(Number((e.target as HTMLInputElement).value))}
						class="form-control w-20"
					/>
				</div>
			</label>
		{/if}
	</div>
</div>
