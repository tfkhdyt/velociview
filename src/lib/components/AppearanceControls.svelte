<script lang="ts">
	import { GOOGLE_FONTS, type GoogleFontEntry } from '$lib/page-utils';

	let {
		selectedFontFamily,
		scale,
		backdropOpacity,
		textAlign,
		onFontSelect,
		onScaleChange,
		onBackdropOpacityChange,
		onTextAlignChange
	}: {
		selectedFontFamily: string;
		scale: number;
		backdropOpacity: number;
		textAlign: 'left' | 'center' | 'right';
		onFontSelect: (font: GoogleFontEntry) => void;
		onScaleChange: (value: number) => void;
		onBackdropOpacityChange: (value: number) => void;
		onTextAlignChange: (value: 'left' | 'center' | 'right') => void;
	} = $props();
</script>

<div class="space-y-2">
	<h3 class="text-sm font-semibold tracking-tight">Appearance</h3>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="block text-sm">
			<span class="form-label">Font</span>
			<select
				class="form-control"
				onchange={(e) => {
					const selected = (e.target as HTMLSelectElement).value;
					const entry = GOOGLE_FONTS.find((f) => f.family === selected);
					if (entry) onFontSelect(entry);
				}}
			>
				{#each GOOGLE_FONTS as f (f.family)}
					<option value={f.family} selected={selectedFontFamily.startsWith(f.family)}
						>{f.label}</option
					>
				{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="form-label">Alignment</span>
			<select
				bind:value={textAlign}
				class="form-control"
				onchange={(e) =>
					onTextAlignChange((e.target as HTMLSelectElement).value as 'left' | 'center' | 'right')}
			>
				<option value="left">Left</option>
				<option value="center">Center</option>
				<option value="right">Right</option>
			</select>
		</label>
		<label class="block text-sm">
			<span class="form-label">Scale</span>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="0.5"
					max="3"
					step="0.05"
					bind:value={scale}
					oninput={(e) => onScaleChange(Number((e.target as HTMLInputElement).value))}
					class="form-range"
				/>
				<input
					type="number"
					min="0.5"
					max="3"
					step="0.05"
					bind:value={scale}
					oninput={(e) => onScaleChange(Number((e.target as HTMLInputElement).value))}
					class="form-control w-20"
				/>
			</div>
		</label>
		<label class="block text-sm">
			<span class="form-label">Darken image</span>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="0"
					max="0.9"
					step="0.01"
					bind:value={backdropOpacity}
					oninput={(e) => onBackdropOpacityChange(Number((e.target as HTMLInputElement).value))}
					class="form-range"
				/>
				<input
					type="number"
					min="0"
					max="0.9"
					step="0.01"
					bind:value={backdropOpacity}
					oninput={(e) => onBackdropOpacityChange(Number((e.target as HTMLInputElement).value))}
					class="form-control w-20"
				/>
			</div>
		</label>
	</div>
</div>
