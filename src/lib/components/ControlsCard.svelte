<script lang="ts">
	import ActionButtons from '$lib/components/ActionButtons.svelte';
	import AppearanceControls from '$lib/components/AppearanceControls.svelte';
	import ExportControls from '$lib/components/ExportControls.svelte';
	import FieldsSelector from '$lib/components/FieldsSelector.svelte';
	import LayoutControls from '$lib/components/LayoutControls.svelte';
	import PositionControls from '$lib/components/PositionControls.svelte';
	import UploadSection from '$lib/components/UploadSection.svelte';
	import type { OverlayField, StatValues } from '$lib/overlay';
	import type { PositionPreset } from '$lib/page-utils';

	let {
		imageLoading,
		gpxLoading,
		values,
		imageBitmap,
		imageInputEl = $bindable(),
		gpxInputEl = $bindable(),
		onImageChange,
		onGpxChange,
		onResetClick,
		// fields & position
		selectedFields,
		onFieldsChange,
		positionPreset,
		onPresetChange,
		// layout
		gridMode,
		gridColumns,
		gridGapScale,
		onLayoutChange,
		// appearance
		fontFamily,
		scale,
		backdropOpacity,
		textAlign,
		onFontSelect,
		onScaleChange,
		onBackdropOpacityChange,
		onTextAlignChange,
		// export
		exportFormat,
		exportQuality,
		onExportOptionsChange,
		// actions
		canCopyToClipboard,
		canShare,
		copying,
		sharing,
		justCopied,
		onExportClick,
		onCopyClick,
		onShareClick
	}: {
		imageLoading: boolean;
		gpxLoading: boolean;
		values: StatValues | null;
		imageBitmap: ImageBitmap | null;
		imageInputEl: HTMLInputElement | null;
		gpxInputEl: HTMLInputElement | null;
		onImageChange: (files: FileList | null) => void | Promise<void>;
		onGpxChange: (files: FileList | null) => void | Promise<void>;
		onResetClick: () => void;
		selectedFields: OverlayField[];
		onFieldsChange: (next: OverlayField[]) => void;
		positionPreset: PositionPreset | 'custom';
		onPresetChange: (preset: PositionPreset | 'custom') => void;
		gridMode: 'list' | 'auto' | 'fixed';
		gridColumns: number;
		gridGapScale: number;
		onLayoutChange: (params: {
			gridMode: 'list' | 'auto' | 'fixed';
			gridColumns: number;
			gridGapScale: number;
		}) => void;
		fontFamily: string;
		scale: number;
		backdropOpacity: number;
		textAlign: 'left' | 'center' | 'right';
		onFontSelect: (entry: { family: string; fallback: string }) => void | Promise<void>;
		onScaleChange: (v: number) => void;
		onBackdropOpacityChange: (v: number) => void;
		onTextAlignChange: (v: 'left' | 'center' | 'right') => void;
		exportFormat: 'png' | 'jpeg' | 'webp';
		exportQuality: number;
		onExportOptionsChange: (p: {
			exportFormat: 'png' | 'jpeg' | 'webp';
			exportQuality: number;
		}) => void;
		canCopyToClipboard: boolean;
		canShare: boolean;
		copying: boolean;
		sharing: boolean;
		justCopied: boolean;
		onExportClick: () => void | Promise<void>;
		onCopyClick: () => void | Promise<void>;
		onShareClick: () => void | Promise<void>;
	} = $props();
</script>

<div
	class="rounded-2xl border border-border bg-white/30 p-5 shadow-lg backdrop-blur-md duration-200 [[data-theme=dark]_&]:bg-zinc-900/30"
	role="region"
	aria-label="Upload controls"
>
	<h2 class="mb-4 text-base font-semibold tracking-tight">Upload</h2>
	<UploadSection
		{imageLoading}
		{gpxLoading}
		{onImageChange}
		{onGpxChange}
		bind:imageInputEl
		bind:gpxInputEl
	/>

	{#if values && imageBitmap}
		<hr class="my-6 border-t border-border" />
		<div class="mt-6 space-y-5">
			<h2 class="mb-4 text-base font-semibold tracking-tight">Control</h2>

			<FieldsSelector {selectedFields} onChange={onFieldsChange} />

			<div class="space-y-8 pb-4">
				<PositionControls {positionPreset} {onPresetChange} />

				<LayoutControls
					{gridMode}
					{gridColumns}
					{gridGapScale}
					maxColumns={selectedFields.length}
					onChange={onLayoutChange}
				/>

				<AppearanceControls
					selectedFontFamily={fontFamily}
					{scale}
					{backdropOpacity}
					{textAlign}
					{onFontSelect}
					{onScaleChange}
					{onBackdropOpacityChange}
					{onTextAlignChange}
				/>

				<ExportControls {exportFormat} {exportQuality} onChange={onExportOptionsChange} />
			</div>

			<ActionButtons
				canExport={Boolean(imageBitmap && values)}
				canCopy={Boolean(imageBitmap && values && canCopyToClipboard)}
				canShare={Boolean(imageBitmap && values && canShare)}
				{copying}
				{sharing}
				{justCopied}
				{onExportClick}
				{onCopyClick}
				{onShareClick}
				{onResetClick}
			/>
		</div>
	{/if}
</div>
