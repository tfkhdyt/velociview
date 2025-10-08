<script lang="ts">
	let {
		mapPosition,
		onChange
	}: {
		mapPosition: 'top' | 'left' | 'right' | 'bottom' | 'grid';
		onChange: (position: 'top' | 'left' | 'right' | 'bottom' | 'grid') => void;
	} = $props();
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Map Position</h3>
	<div class="grid grid-cols-2 gap-2">
		<label class="inline-flex items-center gap-2 text-sm">
			<input
				type="radio"
				name="mapPosition"
				value="top"
				checked={mapPosition === 'top'}
				onchange={(e) => onChange((e.target as HTMLInputElement).value as 'top')}
				class="form-radio"
			/>
			<span>Top</span>
		</label>
		<label class="inline-flex items-center gap-2 text-sm">
			<input
				type="radio"
				name="mapPosition"
				value="left"
				checked={mapPosition === 'left'}
				onchange={(e) => onChange((e.target as HTMLInputElement).value as 'left')}
				class="form-radio"
			/>
			<span>Left</span>
		</label>
		<label class="inline-flex items-center gap-2 text-sm">
			<input
				type="radio"
				name="mapPosition"
				value="right"
				checked={mapPosition === 'right'}
				onchange={(e) => onChange((e.target as HTMLInputElement).value as 'right')}
				class="form-radio"
			/>
			<span>Right</span>
		</label>
		<label class="inline-flex items-center gap-2 text-sm">
			<input
				type="radio"
				name="mapPosition"
				value="bottom"
				checked={mapPosition === 'bottom'}
				onchange={(e) => onChange((e.target as HTMLInputElement).value as 'bottom')}
				class="form-radio"
			/>
			<span>Bottom</span>
		</label>
		<label class="col-span-2 inline-flex items-center gap-2 text-sm">
			<input
				type="radio"
				name="mapPosition"
				value="grid"
				checked={mapPosition === 'grid'}
				onchange={(e) => onChange((e.target as HTMLInputElement).value as 'grid')}
				class="form-radio"
			/>
			<span>Grid (same size as other items)</span>
		</label>
	</div>
</div>
