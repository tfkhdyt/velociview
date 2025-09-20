<script lang="ts">
	import ActionButtons from '$lib/components/ActionButtons.svelte';
	import AppearanceControls from '$lib/components/AppearanceControls.svelte';
	import ExportControls from '$lib/components/ExportControls.svelte';
	import FieldsSelector from '$lib/components/FieldsSelector.svelte';
	import LayoutControls from '$lib/components/LayoutControls.svelte';
	import PositionControls from '$lib/components/PositionControls.svelte';
	import UploadSection from '$lib/components/UploadSection.svelte';
	import {
		OVERLAY_FIELD_ORDER,
		renderOverlay,
		type OverlayField,
		type OverlayOptions,
		type StatValues
	} from '$lib/overlay';
	import {
		buildDownloadFilename,
		ensureFontLoaded,
		getMimeAndExt,
		GOOGLE_FONTS,
		isImageFile,
		isTcxFile,
		presetToPosition,
		type PositionPreset
	} from '$lib/page-utils';
	import { parseTcxToOverlayValues } from '$lib/tcx';
	import { onMount } from 'svelte';

	// removed unused file state to satisfy linter
	let imageBitmap: ImageBitmap | null = $state(null);
	let imageUrl: string | null = $state(null);
	let imageBaseName: string = $state('');
	type ClipboardItemCtor = new (items: Record<string, Blob>) => ClipboardItem;
	let clipboardItemCtor: ClipboardItemCtor | null = $state(null);

	let originalWidth = $state(0);
	let originalHeight = $state(0);

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let previewCanvasEl: HTMLCanvasElement | null = $state(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let previewCtx: CanvasRenderingContext2D | null = null;

	let backdropOpacity = $state(0);
	let selectedFields: OverlayField[] = $state(
		OVERLAY_FIELD_ORDER.filter(
			(f) => f !== 'maxSpeed' && f !== 'ascent' && f !== 'descent' && f !== 'maxPace'
		)
	);
	let scale = $state(1);
	let posX = $state(0.05); // normalized 0..1
	let posY = $state(0.95); // normalized 0..1 (matches "bottom left" preset)
	let fontFamily = $state('Inter, system-ui, Arial, sans-serif');

	// Increment to force re-render after a font finishes loading
	let fontVersion = $state(0);
	let textAlign = $state<'left' | 'center' | 'right'>('left');
	let gridMode = $state<'list' | 'auto' | 'fixed'>('list');
	let gridColumns = $state(2);
	let gridGapScale = $state(1);

	// Export options
	let exportFormat = $state<'png' | 'jpeg' | 'webp'>('jpeg');
	let exportQuality = $state(0.92); // used for lossy formats only

	// Ensure web fonts (e.g., Inter) are loaded before any canvas rendering
	let fontsReady = $state(false);
	let canCopyToClipboard = $state(false);
	let justCopied = $state(false);
	let copying = $state(false);
	onMount(() => {
		const primaryFamily = fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
		// Proactively load primary weights used by the UI
		Promise.all([
			document.fonts.load(`400 16px ${primaryFamily}`),
			document.fonts.load(`600 16px ${primaryFamily}`),
			document.fonts.load(`700 16px ${primaryFamily}`)
		]).then(() => {
			fontsReady = true;
		});

		// Clipboard API capability check (browser-only)
		try {
			const hasClipboard =
				typeof navigator !== 'undefined' &&
				'clipboard' in navigator &&
				typeof (navigator.clipboard as { write?: unknown }).write === 'function';
			const hasClipboardItem = typeof window !== 'undefined' && 'ClipboardItem' in window;
			if (hasClipboardItem) {
				clipboardItemCtor = (window as unknown as { ClipboardItem: ClipboardItemCtor })
					.ClipboardItem;
			}
			canCopyToClipboard = Boolean(hasClipboard && hasClipboardItem);
		} catch {
			canCopyToClipboard = false;
		}

		// Warm all Google fonts in the background so switching is instant
		for (const f of GOOGLE_FONTS) {
			if (f.family === primaryFamily) continue;
			// fire-and-forget warmup
			ensureFontLoaded(f.family).then(() => {
				// optional: bump version to trigger re-render when a new family completes
				fontVersion++;
			});
		}
	});

	let positionPreset = $state<PositionPreset | 'custom'>('bottom left');

	let values: StatValues | null = $state(null);

	// Loading indicator for TCX parsing
	let tcxLoading: boolean = $state(false);

	// Drag & drop states
	let isDragActiveUpload = $state(false);
	let isDragActivePreview = $state(false);
	let uploadDragCounter = $state(0);
	let previewDragCounter = $state(0);

	// Combined chooser ref (removed unused input reference)

	// Track last measured overlay box size from render to improve drag mapping
	let overlayBoxWidth = $state(0);
	let overlayBoxHeight = $state(0);

	function resetAll(): void {
		// no file state retained
		imageBitmap = null;
		imageUrl = null;
		originalWidth = 0;
		originalHeight = 0;
		values = null;
	}

	async function loadImageFile(file: File): Promise<void> {
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageUrl = URL.createObjectURL(file);
		// derive a safe base name from the original file name (without extension)
		const rawBase = file.name.replace(/\.[^.]+$/, '');
		imageBaseName = rawBase
			.toLowerCase()
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/^-+|-+$/g, '');
		const bmp = await createImageBitmap(file);
		imageBitmap = bmp;
		originalWidth = bmp.width;
		originalHeight = bmp.height;
		ensureContexts();
	}

	async function handleImageChange(files: FileList | null): Promise<void> {
		if (!files || files.length === 0) return;
		await loadImageFile(files[0]);
	}

	async function loadTcxFile(file: File): Promise<void> {
		tcxLoading = true;
		try {
			const text = await file.text();
			values = await parseTcxToOverlayValues(text);
		} finally {
			tcxLoading = false;
		}
	}

	async function handleTcxChange(files: FileList | null): Promise<void> {
		if (!files || files.length === 0) return;
		await loadTcxFile(files[0]);
	}

	async function processDroppedFiles(files: FileList | File[]): Promise<void> {
		const arr: File[] = Array.from(files as unknown as ArrayLike<File>);
		const image = arr.find((f) => isImageFile(f));
		const tcx = arr.find((f) => isTcxFile(f));
		if (image) await loadImageFile(image);
		if (tcx) await loadTcxFile(tcx);
	}

	// removed unused handler

	function handleDragOver(e: DragEvent): void {
		e.preventDefault();
	}

	function handleDragEnterUpload(e: DragEvent): void {
		e.preventDefault();
		uploadDragCounter++;
		isDragActiveUpload = true;
	}
	function handleDragLeaveUpload(): void {
		uploadDragCounter = Math.max(0, uploadDragCounter - 1);
		if (uploadDragCounter === 0) isDragActiveUpload = false;
	}
	async function handleDropUpload(e: DragEvent): Promise<void> {
		e.preventDefault();
		isDragActiveUpload = false;
		uploadDragCounter = 0;
		const dt = e.dataTransfer;
		if (!dt || !dt.files || dt.files.length === 0) return;
		await processDroppedFiles(dt.files);
	}

	function handleDragEnterPreview(e: DragEvent): void {
		e.preventDefault();
		previewDragCounter++;
		isDragActivePreview = true;
	}
	function handleDragLeavePreview(): void {
		previewDragCounter = Math.max(0, previewDragCounter - 1);
		if (previewDragCounter === 0) isDragActivePreview = false;
	}
	async function handleDropPreview(e: DragEvent): Promise<void> {
		e.preventDefault();
		isDragActivePreview = false;
		previewDragCounter = 0;
		const dt = e.dataTransfer;
		if (!dt || !dt.files || dt.files.length === 0) return;
		await processDroppedFiles(dt.files);
	}

	function ensureContexts(): void {
		if (canvasEl && !ctx) {
			const c = canvasEl.getContext('2d', { willReadFrequently: false });
			if (!c) throw new Error('Failed to get 2d context');
			ctx = c;
		}
		if (previewCanvasEl && !previewCtx) {
			const c = previewCanvasEl.getContext('2d', { willReadFrequently: true });
			if (!c) throw new Error('Failed to get 2d context');
			previewCtx = c;
		}
	}

	function getOverlayOptions(): OverlayOptions {
		return {
			selectedFields,
			position: { x: posX, y: posY },
			scale,
			fontFamily,
			primaryColor: '#ffffff',
			secondaryColor: '#000000',
			backgroundMode: 'transparent',
			backgroundOpacity: 0,
			textAlign,
			gridMode,
			gridColumns,
			gridGapScale
		};
	}

	$effect(() => {
		// re-run when a font finishes loading in the background
		void fontVersion;
		// Clamp gridColumns when in fixed mode to the current number of selected fields
		if (gridMode === 'fixed') {
			const maxCols = Math.max(1, selectedFields.length);
			if (gridColumns > maxCols) gridColumns = maxCols;
			if (gridColumns < 1) gridColumns = 1;
		}
		// ensure contexts on mount
		ensureContexts();

		// Wait until fonts are ready so canvas uses Inter instead of fallback
		if (!fontsReady || !imageBitmap || !previewCtx || !previewCanvasEl) return;
		const maxPreviewWidth = 1000;
		let previewWidth = imageBitmap.width;
		let previewHeight = imageBitmap.height;
		if (previewWidth > maxPreviewWidth) {
			const ratio = maxPreviewWidth / previewWidth;
			previewWidth = Math.round(previewWidth * ratio);
			previewHeight = Math.round(previewHeight * ratio);
		}
		previewCanvasEl.width = previewWidth;
		previewCanvasEl.height = previewHeight;
		previewCtx.clearRect(0, 0, previewWidth, previewHeight);
		previewCtx.drawImage(imageBitmap, 0, 0, previewWidth, previewHeight);
		if (backdropOpacity > 0) {
			previewCtx.save();
			previewCtx.fillStyle = `rgba(0, 0, 0, ${backdropOpacity})`;
			previewCtx.fillRect(0, 0, previewWidth, previewHeight);
			previewCtx.restore();
		}
		if (values) {
			const res = renderOverlay(
				previewCtx,
				previewWidth,
				previewHeight,
				values,
				getOverlayOptions()
			);
			overlayBoxWidth = res.width;
			overlayBoxHeight = res.height;
		}
	});

	async function exportImage(): Promise<void> {
		// Ensure web fonts (e.g., Inter) are loaded before rasterizing to PNG
		try {
			await (document.fonts as FontFaceSet).ready;
		} catch {
			// ignore if Font Loading API unsupported
		}
		const c = canvasEl;
		if (!imageBitmap || !ctx || !values || !c) return;
		c.width = originalWidth;
		c.height = originalHeight;
		ctx.clearRect(0, 0, originalWidth, originalHeight);
		ctx.drawImage(imageBitmap, 0, 0, originalWidth, originalHeight);
		if (backdropOpacity > 0) {
			ctx.save();
			ctx.fillStyle = `rgba(0, 0, 0, ${backdropOpacity})`;
			ctx.fillRect(0, 0, originalWidth, originalHeight);
			ctx.restore();
		}
		// Scale overlay to match what you see in the preview by compensating
		// for the preview downscaling relative to the original image size.
		const previewWidthRef = previewCanvasEl?.width ?? originalWidth;
		const exportScaleFactor = originalWidth / Math.max(1, previewWidthRef);
		const exportOptions: OverlayOptions = {
			...getOverlayOptions(),
			scale: scale * exportScaleFactor
		};
		renderOverlay(ctx, originalWidth, originalHeight, values, exportOptions);
		const { mime, ext } = getMimeAndExt(exportFormat);
		const qualityParam =
			exportFormat === 'png' ? undefined : Math.max(0, Math.min(1, exportQuality));
		const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, mime, qualityParam));
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = buildDownloadFilename(imageBaseName, values, ext);
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function copyImageToClipboard(): Promise<void> {
		if (copying) return;
		copying = true;
		justCopied = false;
		try {
			// Ensure web fonts are ready before rasterizing
			try {
				await (document.fonts as FontFaceSet).ready;
			} catch {
				// ignore if unsupported
			}
			const c = canvasEl;
			if (!imageBitmap || !ctx || !values || !c) return;
			c.width = originalWidth;
			c.height = originalHeight;
			ctx.clearRect(0, 0, originalWidth, originalHeight);
			ctx.drawImage(imageBitmap, 0, 0, originalWidth, originalHeight);
			if (backdropOpacity > 0) {
				ctx.save();
				ctx.fillStyle = `rgba(0, 0, 0, ${backdropOpacity})`;
				ctx.fillRect(0, 0, originalWidth, originalHeight);
				ctx.restore();
			}
			const previewWidthRef = previewCanvasEl?.width ?? originalWidth;
			const exportScaleFactor = originalWidth / Math.max(1, previewWidthRef);
			const exportOptions: OverlayOptions = {
				...getOverlayOptions(),
				scale: scale * exportScaleFactor
			};
			renderOverlay(ctx, originalWidth, originalHeight, values, exportOptions);
			if (!canCopyToClipboard || !clipboardItemCtor) {
				await exportImage();
				return;
			}
			const ctor: ClipboardItemCtor = clipboardItemCtor;
			const { mime } = getMimeAndExt(exportFormat);
			const tryWrite = async (targetMime: string, quality?: number): Promise<boolean> => {
				const b: Blob | null = await new Promise((resolve) =>
					c.toBlob(resolve, targetMime, quality)
				);
				if (!b) return false;
				try {
					const item = new ctor({ [targetMime]: b });
					await navigator.clipboard.write([item]);
					return true;
				} catch {
					return false;
				}
			};
			const qualityParam =
				exportFormat === 'png' ? undefined : Math.max(0, Math.min(1, exportQuality));
			let success = await tryWrite(mime, qualityParam);
			if (!success && mime !== 'image/png') {
				// Fallback to PNG if chosen mime is unsupported by the clipboard or failed
				success = await tryWrite('image/png');
			}
			if (!success) {
				await exportImage();
				return;
			}
			justCopied = true;
			setTimeout(() => {
				justCopied = false;
			}, 1500);
		} finally {
			copying = false;
		}
	}

	let dragging = $state(false);
	let dragAnchorOffsetCanvas = $state({ x: 0, y: 0 });

	function handlePointerDown(e: PointerEvent): void {
		if (!previewCanvasEl) return;
		dragging = true;
		previewCanvasEl.setPointerCapture(e.pointerId);
		const rect = previewCanvasEl.getBoundingClientRect();
		const mouseXcss = e.clientX - rect.left;
		const mouseYcss = e.clientY - rect.top;
		const canvasW = previewCanvasEl.width;
		const canvasH = previewCanvasEl.height;
		const mouseX = (mouseXcss / Math.max(1, rect.width)) * canvasW;
		const mouseY = (mouseYcss / Math.max(1, rect.height)) * canvasH;
		const boxW = overlayBoxWidth;
		const boxH = overlayBoxHeight;
		const availW = Math.max(0, canvasW - boxW);
		const availH = Math.max(0, canvasH - boxH);
		const topLeftX = availW > 0 ? posX * availW : posX * canvasW;
		const topLeftY = availH > 0 ? posY * availH : posY * canvasH;
		dragAnchorOffsetCanvas = {
			x: Math.max(0, Math.min(boxW || canvasW, mouseX - topLeftX)),
			y: Math.max(0, Math.min(boxH || canvasH, mouseY - topLeftY))
		};
	}
	function handlePointerMove(e: PointerEvent): void {
		if (!dragging || !previewCanvasEl) return;
		const rect = previewCanvasEl.getBoundingClientRect();
		const mouseXcss = e.clientX - rect.left;
		const mouseYcss = e.clientY - rect.top;
		const canvasW = previewCanvasEl.width;
		const canvasH = previewCanvasEl.height;
		const mouseX = (mouseXcss / Math.max(1, rect.width)) * canvasW;
		const mouseY = (mouseYcss / Math.max(1, rect.height)) * canvasH;
		const boxW = overlayBoxWidth;
		const boxH = overlayBoxHeight;
		const availW = Math.max(1, canvasW - boxW);
		const availH = Math.max(1, canvasH - boxH);
		let topLeftX = mouseX - dragAnchorOffsetCanvas.x;
		let topLeftY = mouseY - dragAnchorOffsetCanvas.y;
		topLeftX = Math.max(0, Math.min(availW, topLeftX));
		topLeftY = Math.max(0, Math.min(availH, topLeftY));
		posX = topLeftX / availW;
		posY = topLeftY / availH;
		positionPreset = 'custom';
	}
	function handlePointerUp(e: PointerEvent): void {
		if (previewCanvasEl) {
			try {
				previewCanvasEl.releasePointerCapture(e.pointerId);
			} catch {
				// ignore if not captured
			}
		}
		dragging = false;
	}
	function handlePointerCancel(): void {
		dragging = false;
	}

	const presetMargin = 0.05; // normalized margin from edges

	function applyPositionPreset(preset: PositionPreset): void {
		const { x, y } = presetToPosition(preset, presetMargin);
		posX = x;
		posY = y;
		positionPreset = preset;
	}
</script>

<section class="space-y-6">
	<div class="grid items-start gap-6 lg:grid-cols-2">
		<!-- Controls Card -->
		<div
			class={`rounded-2xl border bg-white/30 p-5 shadow-lg backdrop-blur-md transition-colors duration-200 [[data-theme=dark]_&]:bg-zinc-900/30 ${
				isDragActiveUpload ? 'border-accent' : 'border-border'
			}`}
			ondragover={handleDragOver}
			ondragenter={handleDragEnterUpload}
			ondragleave={handleDragLeaveUpload}
			ondrop={handleDropUpload}
			role="region"
			aria-label="Upload area. Drop image and TCX files to load."
		>
			<h2 class="mb-4 text-base font-semibold tracking-tight">Upload</h2>
			<!-- Whole card acts as dropzone -->
			<UploadSection {tcxLoading} onImageChange={handleImageChange} onTcxChange={handleTcxChange} />

			{#if values && imageBitmap}
				<div class="mt-6 space-y-5">
					<FieldsSelector {selectedFields} onChange={(next) => (selectedFields = next)} />

					<!-- Reordered controls: Position, Layout, Appearance -->
					<div class="space-y-5">
						<!-- Position -->
						<PositionControls
							{positionPreset}
							onPresetChange={(value) => {
								if (value !== 'custom') applyPositionPreset(value as PositionPreset);
							}}
						/>

						<!-- Layout -->
						<LayoutControls
							{gridMode}
							{gridColumns}
							{gridGapScale}
							maxColumns={selectedFields.length}
							onChange={({ gridMode: m, gridColumns: c, gridGapScale: g }) => {
								gridMode = m;
								gridColumns = c;
								gridGapScale = g;
							}}
						/>

						<!-- Appearance -->
						<AppearanceControls
							selectedFontFamily={fontFamily}
							{scale}
							{backdropOpacity}
							{textAlign}
							onFontSelect={(entry) => {
								const needsQuote = /\s/.test(entry.family);
								const first = needsQuote ? `"${entry.family}"` : entry.family;
								fontFamily = `${first}, ${entry.fallback}`;
								ensureFontLoaded(entry.family).then(() => {
									fontVersion++;
								});
							}}
							onScaleChange={(v) => (scale = v)}
							onBackdropOpacityChange={(v) => (backdropOpacity = v)}
							onTextAlignChange={(v) => (textAlign = v)}
						/>

						<!-- Export -->
						<ExportControls
							{exportFormat}
							{exportQuality}
							onChange={({ exportFormat: f, exportQuality: q }) => {
								exportFormat = f;
								exportQuality = q;
							}}
						/>
					</div>

					<ActionButtons
						canExport={Boolean(imageBitmap && values)}
						canCopy={Boolean(imageBitmap && values && canCopyToClipboard)}
						{copying}
						{justCopied}
						onExportClick={exportImage}
						onCopyClick={copyImageToClipboard}
						onResetClick={resetAll}
					/>
				</div>
			{/if}
		</div>

		<!-- Preview Card -->
		<div
			class={`rounded-2xl border bg-white/30 p-4 shadow-lg backdrop-blur-md transition-colors duration-200 [[data-theme=dark]_&]:bg-zinc-900/30 ${
				isDragActivePreview ? 'border-accent' : 'border-border'
			}`}
			ondragover={handleDragOver}
			ondragenter={handleDragEnterPreview}
			ondragleave={handleDragLeavePreview}
			ondrop={handleDropPreview}
			role="region"
			aria-label="Preview area. Drop image or TCX files to load."
		>
			{#if imageUrl}
				<div class="relative">
					<canvas
						bind:this={previewCanvasEl}
						class="h-auto w-full cursor-move rounded-lg border border-border"
						onpointerdown={handlePointerDown}
						onpointermove={handlePointerMove}
						onpointerup={handlePointerUp}
						onpointercancel={handlePointerCancel}
					></canvas>
				</div>
			{:else}
				<div
					class={`flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-sm transition-colors ${
						isDragActivePreview ? 'border-accent text-accent' : 'border-border text-muted'
					}`}
					style={isDragActivePreview
						? 'background-color: color-mix(in srgb, var(--color-accent) 5%, transparent);'
						: ''}
				>
					Upload or drop an image to start.
				</div>
			{/if}
			<canvas bind:this={canvasEl} class="hidden"></canvas>
		</div>
	</div>
</section>
