<script lang="ts">
	import {
		getOverlayFieldLabel,
		OVERLAY_FIELD_ORDER,
		renderOverlay,
		type OverlayField,
		type OverlayOptions,
		type StatValues
	} from '$lib/overlay';
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
	// Popular Google Fonts list with sensible system fallbacks
	const googleFonts: Array<{ label: string; family: string; css: string; fallback: string }> = [
		{ label: 'Inter', family: 'Inter', css: 'Inter', fallback: 'system-ui, Arial, sans-serif' },
		{ label: 'Roboto', family: 'Roboto', css: 'Roboto', fallback: 'system-ui, Arial, sans-serif' },
		{
			label: 'Open Sans',
			family: 'Open Sans',
			css: 'Open+Sans',
			fallback: 'system-ui, Arial, sans-serif'
		},
		{ label: 'Lato', family: 'Lato', css: 'Lato', fallback: 'system-ui, Arial, sans-serif' },
		{
			label: 'Montserrat',
			family: 'Montserrat',
			css: 'Montserrat',
			fallback: 'system-ui, Arial, sans-serif'
		},
		{
			label: 'Poppins',
			family: 'Poppins',
			css: 'Poppins',
			fallback: 'system-ui, Arial, sans-serif'
		},
		{
			label: 'Source Sans 3',
			family: 'Source Sans 3',
			css: 'Source+Sans+3',
			fallback: 'system-ui, Arial, sans-serif'
		},
		{ label: 'Nunito', family: 'Nunito', css: 'Nunito', fallback: 'system-ui, Arial, sans-serif' },
		{
			label: 'Merriweather',
			family: 'Merriweather',
			css: 'Merriweather',
			fallback: 'Georgia, serif'
		},
		{
			label: 'Playfair Display',
			family: 'Playfair Display',
			css: 'Playfair+Display',
			fallback: 'Georgia, serif'
		}
	];

	async function ensureFontLoaded(targetFamily: string): Promise<void> {
		const clean = targetFamily.replace(/['"]/g, '').trim();
		try {
			await Promise.all([
				document.fonts.load(`400 16px ${clean}`),
				document.fonts.load(`600 16px ${clean}`),
				document.fonts.load(`700 16px ${clean}`)
			]);
		} catch {
			// ignore
		}
	}

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
		for (const f of googleFonts) {
			if (f.family === primaryFamily) continue;
			// fire-and-forget warmup
			ensureFontLoaded(f.family).then(() => {
				// optional: bump version to trigger re-render when a new family completes
				fontVersion++;
			});
		}
	});

	// Position presets for quick placement
	type PositionPreset =
		| 'top'
		| 'left'
		| 'center'
		| 'right'
		| 'bottom'
		| 'top left'
		| 'top right'
		| 'bottom left'
		| 'bottom right';

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

	function isTcxFile(file: File): boolean {
		const name = file.name.toLowerCase();
		if (name.endsWith('.tcx')) return true;
		const type = file.type;
		return (
			type === 'application/vnd.garmin.tcx+xml' || type === 'application/xml' || type === 'text/xml'
		);
	}

	function isImageFile(file: File): boolean {
		return file.type.startsWith('image/');
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

	function getMimeAndExt(fmt: 'png' | 'jpeg' | 'webp'): { mime: string; ext: string } {
		switch (fmt) {
			case 'jpeg':
				return { mime: 'image/jpeg', ext: 'jpg' };
			case 'webp':
				return { mime: 'image/webp', ext: 'webp' };
			case 'png':
			default:
				return { mime: 'image/png', ext: 'png' };
		}
	}

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
		// Build a descriptive filename using image name, distance and time if available
		const base = imageBaseName || 'overlay';
		const distMatch = values.distance.match(/([0-9]+(?:\.[0-9]+)?)/);
		const distPart = distMatch ? `${distMatch[1]}km` : null;
		const timePart = values.movingTime.replace(/[^0-9]+/g, '-').replace(/^-+|-+$/g, '');
		const parts = [base, distPart, timePart].filter((p): p is string => Boolean(p && p.length > 0));
		a.download = `${parts.join('_')}.${ext}`;
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
		// Update posX/posY based on preset name
		switch (preset) {
			case 'center':
				posX = 0.5;
				posY = 0.5;
				break;
			case 'top':
				posX = 0.5;
				posY = presetMargin;
				break;
			case 'bottom':
				posX = 0.5;
				posY = 1 - presetMargin;
				break;
			case 'left':
				posX = presetMargin;
				posY = 0.5;
				break;
			case 'right':
				posX = 1 - presetMargin;
				posY = 0.5;
				break;
			case 'top left':
				posX = presetMargin;
				posY = presetMargin;
				break;
			case 'top right':
				posX = 1 - presetMargin;
				posY = presetMargin;
				break;
			case 'bottom left':
				posX = presetMargin;
				posY = 1 - presetMargin;
				break;
			case 'bottom right':
				posX = 1 - presetMargin;
				posY = 1 - presetMargin;
				break;
		}
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
			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<label class="form-label" for="image-input">Image</label>
					<input
						id="image-input"
						type="file"
						accept="image/*"
						onchange={(e) => handleImageChange((e.target as HTMLInputElement).files)}
						class="form-control"
					/>
				</div>
				<div class="space-y-2">
					<label class="form-label" for="tcx-input">TCX</label>
					<div class="relative">
						<input
							id="tcx-input"
							type="file"
							accept=".tcx,application/vnd.garmin.tcx+xml,application/xml,text/xml"
							onchange={(e) => handleTcxChange((e.target as HTMLInputElement).files)}
							disabled={tcxLoading}
							class="form-control pr-10 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						{#if tcxLoading}
							<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
								<svg
									class="h-5 w-5 animate-spin text-accent"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
									></path>
								</svg>
							</div>
						{/if}
					</div>
				</div>
			</div>

			{#if values && imageBitmap}
				<div class="mt-6 space-y-5">
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
										onchange={(e) => {
											const checked = (e.target as HTMLInputElement).checked;
											const targetField = f as OverlayField;
											if (checked) {
												if (!selectedFields.includes(targetField)) {
													selectedFields = [...selectedFields, targetField];
												}
											} else {
												selectedFields = selectedFields.filter((x) => x !== targetField);
											}
											// Keep selection order consistent
											selectedFields = [...selectedFields].sort(
												(a, b) => OVERLAY_FIELD_ORDER.indexOf(a) - OVERLAY_FIELD_ORDER.indexOf(b)
											);
										}}
										class="form-checkbox"
									/>
									<span>{getOverlayFieldLabel(f as OverlayField)}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Reordered controls: Position, Layout, Appearance -->
					<div class="space-y-5">
						<!-- Position -->
						<div class="space-y-2">
							<h3 class="text-sm font-semibold tracking-tight">Position</h3>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<label class="block text-sm">
									<span class="form-label">Preset</span>
									<select
										bind:value={positionPreset}
										onchange={(e) => {
											const value = (e.target as HTMLSelectElement).value as
												| PositionPreset
												| 'custom';
											if (value !== 'custom') applyPositionPreset(value);
										}}
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

						<!-- Layout -->
						<div class="space-y-2">
							<h3 class="text-sm font-semibold tracking-tight">Layout</h3>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<label class="block text-sm">
									<span class="form-label">Mode</span>
									<select bind:value={gridMode} class="form-control">
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
											max={Math.max(1, selectedFields.length)}
											step="1"
											bind:value={gridColumns}
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
											max="2"
											step="0.05"
											bind:value={gridGapScale}
											class="form-range"
										/>
									</label>
								{/if}
							</div>
						</div>

						<!-- Appearance -->
						<div class="space-y-2">
							<h3 class="text-sm font-semibold tracking-tight">Appearance</h3>
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
								<label class="block text-sm">
									<span class="form-label">Font</span>
									<select
										class="form-control"
										onchange={async (e) => {
											const selected = (e.target as HTMLSelectElement).value;
											const entry = googleFonts.find((f) => f.family === selected);
											if (!entry) return;
											// Quote the first family if it contains spaces
											const needsQuote = /\s/.test(entry.family);
											const first = needsQuote ? `"${entry.family}"` : entry.family;
											fontFamily = `${first}, ${entry.fallback}`;
											// ensure it's loaded, but don't block UI; re-render once loaded
											ensureFontLoaded(entry.family).then(() => {
												fontVersion++;
											});
										}}
									>
										{#each googleFonts as f (f.family)}
											<option value={f.family} selected={fontFamily.startsWith(f.family)}
												>{f.label}</option
											>
										{/each}
									</select>
								</label>
								<label class="block text-sm">
									<span class="form-label">Scale</span>
									<input
										type="range"
										min="0.5"
										max="3"
										step="0.05"
										bind:value={scale}
										class="form-range"
									/>
								</label>
								<label class="block text-sm">
									<span class="form-label">Darken image</span>
									<input
										type="range"
										min="0"
										max="0.9"
										step="0.01"
										bind:value={backdropOpacity}
										class="form-range"
									/>
								</label>
								<label class="block text-sm">
									<span class="form-label">Text alignment</span>
									<select bind:value={textAlign} class="form-control">
										<option value="left">Left</option>
										<option value="center">Center</option>
										<option value="right">Right</option>
									</select>
								</label>
							</div>
						</div>

						<!-- Export -->
						<div class="space-y-2">
							<h3 class="text-sm font-semibold tracking-tight">Export</h3>
							<div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
								<label class="block text-sm">
									<span class="form-label">Format</span>
									<select bind:value={exportFormat} class="form-control">
										<option value="png">PNG (lossless)</option>
										<option value="jpeg">JPEG (lossy)</option>
										<option value="webp">WebP (lossy/lossless)</option>
									</select>
								</label>
								{#if exportFormat !== 'png'}
									<label class="block text-sm">
										<span class="form-label">Quality</span>
										<input
											type="range"
											min="0.4"
											max="1"
											step="0.01"
											bind:value={exportQuality}
											class="form-range"
										/>
									</label>
								{/if}
							</div>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						<button
							class="btn btn-primary"
							onclick={exportImage}
							disabled={!imageBitmap || !values}
						>
							Export
						</button>
						<button
							class="btn btn-secondary"
							onclick={copyImageToClipboard}
							disabled={!imageBitmap || !values || !canCopyToClipboard || copying}
							title={canCopyToClipboard ? 'Copy the image to clipboard' : 'Clipboard not supported'}
						>
							{#if copying}
								<span class="inline-flex items-center gap-2">
									<svg
										class="h-4 w-4 animate-spin"
										viewBox="0 0 24 24"
										fill="none"
										aria-hidden="true"
									>
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
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
						<button class="btn btn-ghost" onclick={resetAll}>Reset</button>
					</div>
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
