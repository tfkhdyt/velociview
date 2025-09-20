<script lang="ts">
	import { getOverlayFieldLabel, OVERLAY_FIELD_ORDER, type OverlayField } from '$lib/overlay';

	let {
		selectedFields,
		onChange
	}: { selectedFields: OverlayField[]; onChange: (next: OverlayField[]) => void } = $props();

	function toggleField(targetField: OverlayField, checked: boolean): void {
		let next = selectedFields.slice();
		if (checked) {
			if (!next.includes(targetField)) next = [...next, targetField];
		} else {
			next = next.filter((x: OverlayField) => x !== targetField);
		}
		next = [...next].sort(
			(a, b) => OVERLAY_FIELD_ORDER.indexOf(a) - OVERLAY_FIELD_ORDER.indexOf(b)
		);
		onChange(next);
	}
</script>

<fieldset
	class="rounded-xl border border-border bg-white/20 p-4 backdrop-blur [[data-theme=dark]_&]:bg-zinc-900/20"
>
	<legend class="form-label px-1">Fields</legend>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		{#each OVERLAY_FIELD_ORDER as f (f)}
			<label class="inline-flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={selectedFields.includes(f as OverlayField)}
					onchange={(e) => toggleField(f as OverlayField, (e.target as HTMLInputElement).checked)}
					class="form-checkbox"
				/>
				<span>{getOverlayFieldLabel(f as OverlayField)}</span>
			</label>
		{/each}
	</div>
</fieldset>
