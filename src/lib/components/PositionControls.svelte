<script lang="ts">
	import type { PositionPreset } from '$lib/page-utils';

	let {
		positionPreset,
		onPresetChange
	}: {
		positionPreset: PositionPreset | 'custom';
		onPresetChange: (value: PositionPreset | 'custom') => void;
	} = $props();
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Position</h3>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<label class="block text-sm">
			<span class="form-label">Preset</span>
			<select
				bind:value={positionPreset}
				onchange={(e) =>
					onPresetChange((e.target as HTMLSelectElement).value as PositionPreset | 'custom')}
				class="form-control"
			>
				<option value="custom">Custom</option>
				<option value="top">Top</option>
				<option value="left">Left</option>
				<option value="center">Center</option>
				<option value="right">Right</option>
				<option value="bottom">Bottom</option>
				<option value="top left">Top left</option>
				<option value="top right">Top right</option>
				<option value="bottom left">Bottom left</option>
				<option value="bottom right">Bottom right</option>
			</select>
		</label>
	</div>
</div>
