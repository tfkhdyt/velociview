<script lang="ts">
	import { parseActivityFile } from '$lib/activity';
	import ControlsCard from '$lib/components/ControlsCard.svelte';
	import DropOverlay from '$lib/components/DropOverlay.svelte';
	import FloatingPreviewButton from '$lib/components/FloatingPreviewButton.svelte';
	import PreviewCard from '$lib/components/PreviewCard.svelte';
	import {
		renderOverlay,
		type OverlayField,
		type OverlayOptions,
		type StatValues
	} from '$lib/overlay';
	import {
		buildDownloadFilename,
		drawWatermark,
		ensureFontLoaded,
		ensureWatermarkReady,
		getMimeAndExt,
		GOOGLE_FONTS,
		isActivityFile,
		isImageFile,
		presetToPosition,
		type PositionPreset
	} from '$lib/page-utils';
	import { onMount, tick } from 'svelte';

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

	let backdropOpacity = $state(0);
	let selectedFields: OverlayField[] = $state([
		'distance',
		'movingTime',
		'avgSpeed',
		'avgPace',
		'avgElevation'
	]);
	let scale = $state(1);
	let posX = $state(0.05); // normalized 0..1
	let posY = $state(0.95); // normalized 0..1 (matches "bottom left" preset)
	let fontFamily = $state('Inter, system-ui, Arial, sans-serif');

	// Manual rendering control - no more reactive dependencies
	let textAlign = $state<'left' | 'center' | 'right'>('left');
	let gridMode = $state<'list' | 'auto' | 'fixed'>('list');
	let gridColumns = $state(2);
	let gridGapScale = $state(1);

	// Mobile floating preview state
	let previewCardEl: HTMLDivElement | null = $state(null);
	let floatingCanvasEl: HTMLCanvasElement | null = $state(null);
	let isPreviewInView: boolean = $state(true);
	let isMobile: boolean = $state(false);
	let floatingVisible: boolean = $state(false);
	let mirrorRafId: number = 0;

	function scheduleMirror(): void {
		if (typeof window === 'undefined') return;
		if (mirrorRafId) cancelAnimationFrame(mirrorRafId);
		mirrorRafId = requestAnimationFrame(() => {
			mirrorRafId = 0;
			mirrorFloatingFromPreview();
		});
	}

	function updateFloatingVisible(): void {
		const next = Boolean(imageUrl) && isMobile && !isPreviewInView;
		const becameTrue = next && !floatingVisible;
		floatingVisible = next;
		if (becameTrue) {
			// Ensure element is mounted and styled before drawing
			tick()
				.then(() => tick())
				.then(() => scheduleMirror());
		}
	}

	// Export options
	let exportFormat = $state<'png' | 'jpeg' | 'webp'>('jpeg');
	let exportQuality = $state(0.92); // used for lossy formats only

	// Ensure web fonts (e.g., Inter) are loaded before any canvas rendering
	let canCopyToClipboard = $state(false);
	let canShare = $state(false);
	let justCopied = $state(false);
	let copying = $state(false);
	let sharing = $state(false);
	onMount(() => {
		const primaryFamily = fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
		// Proactively load primary weights used by the UI
		Promise.all([
			document.fonts.load(`400 16px ${primaryFamily}`),
			document.fonts.load(`600 16px ${primaryFamily}`),
			document.fonts.load(`700 16px ${primaryFamily}`)
		]).then(() => {
			// Initial render once fonts are ready
			requestRender();
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

		// Web Share API capability check (prefer files share)
		try {
			const supportsShare =
				typeof navigator !== 'undefined' && typeof navigator.share === 'function';
			const supportsFiles =
				typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
			// We will share an image file; ensure canShare with files if available
			if (supportsFiles) {
				// Create a tiny placeholder blob to check capability safely
				const testBlob = new Blob(['x'], { type: 'image/png' });
				const file = new File([testBlob], 'test.png', { type: 'image/png' });
				canShare = navigator.canShare?.({ files: [file] }) === true;
			} else {
				canShare = supportsShare;
			}
		} catch {
			canShare = false;
		}

		// Warm all Google fonts in the background so switching is instant
		for (const f of GOOGLE_FONTS) {
			if (f.family === primaryFamily) continue;
			// fire-and-forget warmup
			ensureFontLoaded(f.family).then(() => {
				// trigger re-render when a new family completes
				requestRender();
			});
		}

		// Register document-level dropzone listeners to make whole page a drop target
		document.addEventListener('dragover', handleDocDragOver);
		document.addEventListener('dragenter', handleDocDragEnter);
		document.addEventListener('dragleave', handleDocDragLeave);
		document.addEventListener('drop', handleDocDrop);

		// Floating preview observers/listeners
		let io: IntersectionObserver | null = null;
		let mql: MediaQueryList | null = null;
		let onScrollHandler: (() => void) | null = null;
		const handleMqChange = (e: MediaQueryListEvent): void => {
			isMobile = e.matches;
			updateFloatingVisible();
			mirrorFloatingFromPreview();
		};
		function setupIO(): void {
			if (!previewCardEl) return;
			io = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					const ratio = entry ? entry.intersectionRatio : 0;
					// Consider fully visible only when ~100% of the element is within the viewport
					isPreviewInView = ratio >= 0.999;
					updateFloatingVisible();
					if (!isPreviewInView) scheduleMirror();
				},
				{ root: null, threshold: [0, 1] }
			);
			io.observe(previewCardEl);
		}
		if (typeof window !== 'undefined') {
			// Mobile breakpoint ~ md (<768px)
			mql = window.matchMedia('(max-width: 767px)');
			isMobile = mql.matches;
			mql.addEventListener('change', handleMqChange);
			setupIO();
			window.addEventListener('resize', scheduleMirror, {
				passive: true
			} as AddEventListenerOptions);
			onScrollHandler = () => {
				if (floatingVisible) scheduleMirror();
			};
			window.addEventListener('scroll', onScrollHandler, {
				passive: true
			} as AddEventListenerOptions);
		}

		return () => {
			document.removeEventListener('dragover', handleDocDragOver);
			document.removeEventListener('dragenter', handleDocDragEnter);
			document.removeEventListener('dragleave', handleDocDragLeave);
			document.removeEventListener('drop', handleDocDrop);
			io?.disconnect();
			if (mql) mql.removeEventListener('change', handleMqChange);
			window.removeEventListener('resize', scheduleMirror as EventListener);
			if (onScrollHandler) {
				window.removeEventListener('scroll', onScrollHandler as EventListener);
				onScrollHandler = null;
			}
			if (mirrorRafId) {
				cancelAnimationFrame(mirrorRafId);
				mirrorRafId = 0;
			}
		};
	});

	let positionPreset = $state<PositionPreset | 'custom'>('bottom left');

	let values: StatValues | null = $state(null);

	// Loading indicators for file processing
	let imageLoading: boolean = $state(false);
	// Loading indicator for TCX parsing
	let tcxLoading: boolean = $state(false);

	// Page-wide dropzone state
	let pageDragCounter = $state(0);
	let isDragActivePage = $state(false);

	// File input references for reset functionality
	let imageInputEl: HTMLInputElement | null = $state(null);
	let tcxInputEl: HTMLInputElement | null = $state(null);

	function resetAll(): void {
		// Clear file state
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageBitmap = null;
		imageUrl = null;
		imageBaseName = '';
		originalWidth = 0;
		originalHeight = 0;
		values = null;

		// Clear the preview canvas
		if (previewCanvasEl) {
			const c2d = previewCanvasEl.getContext('2d');
			if (c2d) c2d.clearRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);
		}

		// Clear export canvas context and force re-creation
		ctx = null;

		// Clear file input values to ensure onchange fires for new uploads
		if (imageInputEl) imageInputEl.value = '';
		if (tcxInputEl) tcxInputEl.value = '';
	}

	async function loadImageFile(file: File): Promise<void> {
		imageLoading = true;
		try {
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
			// Force immediate render and update floating visibility
			requestRender();
			updateFloatingVisible();
		} finally {
			imageLoading = false;
		}
	}

	async function handleImageChange(files: FileList | null): Promise<void> {
		if (!files || files.length === 0) return;
		await loadImageFile(files[0]);
	}

	async function loadTcxFile(file: File): Promise<void> {
		tcxLoading = true;
		try {
			const text = await file.text();
			const ext = file.name.split('.').pop() || 'tcx';
			values = await parseActivityFile(text, ext);
			// Re-render with the new values
			requestRender();
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
		const activity = arr.find((f) => isActivityFile(f));
		if (image) await loadImageFile(image);
		if (activity) await loadTcxFile(activity);
	}

	// Document-level (page-wide) dropzone handlers
	function handleDocDragOver(e: DragEvent): void {
		e.preventDefault();
	}
	function handleDocDragEnter(e: DragEvent): void {
		e.preventDefault();
		pageDragCounter++;
		isDragActivePage = true;
	}
	function handleDocDragLeave(): void {
		pageDragCounter = Math.max(0, pageDragCounter - 1);
		if (pageDragCounter === 0) isDragActivePage = false;
	}
	async function handleDocDrop(e: DragEvent): Promise<void> {
		e.preventDefault();
		pageDragCounter = 0;
		isDragActivePage = false;
		const dt = e.dataTransfer;
		if (!dt || !dt.files || dt.files.length === 0) return;
		await processDroppedFiles(dt.files);
	}

	// Delegate preview rendering to child component
	let previewRef: { requestRender: () => void } | null = null;
	function requestRender(): void {
		previewRef?.requestRender();
	}

	function mirrorFloatingFromPreview(): void {
		try {
			if (!floatingCanvasEl || !previewCanvasEl) return;
			if (!imageBitmap) return;
			// Keep it updated even if hidden, but size only when needed
			const srcW = previewCanvasEl.width || 0;
			const srcH = previewCanvasEl.height || 0;
			if (!srcW || !srcH) return;
			// CSS target size for mobile mini preview
			const cssMaxWidth = 176; // ~11rem
			const cssMinWidth = 128; // ~8rem
			let cssW = 0;
			let cssH = 0;
			// Prefer actual rendered width for accurate DPR sizing
			const rect = floatingCanvasEl.getBoundingClientRect();
			if (rect && rect.width) {
				cssW = Math.round(rect.width);
				cssH = Math.round((cssW / srcW) * srcH);
			} else {
				const viewportBased = Math.round(
					(typeof window !== 'undefined' ? window.innerWidth : 360) * 0.42
				);
				cssW = Math.max(cssMinWidth, Math.min(cssMaxWidth, viewportBased));
				cssH = Math.round((cssW / srcW) * srcH);
			}
			// Device pixel ratio for crispness
			const dpr =
				typeof window !== 'undefined'
					? Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)))
					: 1;
			// Only update canvas backing store dimensions if changed
			const targetW = cssW * dpr;
			const targetH = cssH * dpr;
			if (floatingCanvasEl.width !== targetW || floatingCanvasEl.height !== targetH) {
				floatingCanvasEl.width = targetW;
				floatingCanvasEl.height = targetH;
			}
			// Draw scaled copy
			const fctx = floatingCanvasEl.getContext('2d');
			if (!fctx) return;
			fctx.clearRect(0, 0, targetW, targetH);
			fctx.imageSmoothingEnabled = true;
			fctx.imageSmoothingQuality = 'high';
			fctx.drawImage(previewCanvasEl, 0, 0, srcW, srcH, 0, 0, targetW, targetH);
		} catch {
			// ignore drawing errors
		}
	}

	function scrollPreviewIntoView(): void {
		try {
			previewCardEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} catch {
			// ignore
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

	// No $effect - we'll handle rendering manually

	function ensureExportContext(): void {
		if (canvasEl && !ctx) {
			const c = canvasEl.getContext('2d', { willReadFrequently: false });
			if (!c) throw new Error('Failed to get 2d context');
			ctx = c;
		}
	}

	function getExportDimensionsAndScale(targetMime: string): {
		w: number;
		h: number;
		scale: number;
	} {
		const previewWidthRef = previewCanvasEl?.width ?? originalWidth;
		// For lossy formats, use even dimensions to avoid encoder padding artifacts (e.g., 4:2:0)
		const isLossy = targetMime === 'image/jpeg' || targetMime === 'image/webp';
		const targetW = isLossy ? originalWidth - (originalWidth % 2) : originalWidth;
		const targetH = isLossy ? originalHeight - (originalHeight % 2) : originalHeight;
		const exportScaleFactor = targetW / Math.max(1, previewWidthRef);
		return { w: targetW, h: targetH, scale: exportScaleFactor };
	}

	async function ensureFontsReady(): Promise<void> {
		try {
			await (document.fonts as FontFaceSet).ready;
		} catch {
			// ignore if Font Loading API unsupported
		}
	}

	type RenderResult = { blob: Blob; mime: string; ext: string };

	async function renderToCanvasAndBlob(
		format: 'png' | 'jpeg' | 'webp'
	): Promise<RenderResult | null> {
		const c = canvasEl;
		ensureExportContext();
		if (!imageBitmap || !ctx || !values || !c) return null;
		const { mime, ext } = getMimeAndExt(format);
		const { w: targetW, h: targetH, scale: exportScaleFactor } = getExportDimensionsAndScale(mime);
		c.width = targetW;
		c.height = targetH;
		ctx.clearRect(0, 0, targetW, targetH);
		ctx.drawImage(imageBitmap, 0, 0, targetW, targetH);
		if (backdropOpacity > 0) {
			ctx.save();
			ctx.fillStyle = `rgba(0, 0, 0, ${backdropOpacity})`;
			ctx.fillRect(0, 0, targetW, targetH);
			ctx.restore();
		}
		const exportOptions: OverlayOptions = {
			...getOverlayOptions(),
			scale: scale * exportScaleFactor
		};
		const overlayRes = renderOverlay(ctx, targetW, targetH, values, exportOptions);
		// Watermark is applied on all exported/copy/share outputs; avoid overlay box
		drawWatermark(ctx, targetW, targetH, fontFamily, {
			x: overlayRes.x,
			y: overlayRes.y,
			width: overlayRes.width,
			height: overlayRes.height
		});
		const qualityParam = format === 'png' ? undefined : Math.max(0, Math.min(1, exportQuality));
		const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, mime, qualityParam));
		if (!blob) return null;
		return { blob, mime, ext };
	}

	async function exportImage(): Promise<void> {
		await Promise.all([ensureFontsReady(), ensureWatermarkReady()]);
		const result = await renderToCanvasAndBlob(exportFormat);
		if (!result || !values) return;
		const url = URL.createObjectURL(result.blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = buildDownloadFilename(imageBaseName, values, result.ext);
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function shareImage(): Promise<void> {
		if (sharing) return;
		sharing = true;
		try {
			await Promise.all([ensureFontsReady(), ensureWatermarkReady()]);
			const result = await renderToCanvasAndBlob(exportFormat);
			if (!result || !values) return;
			const filename = buildDownloadFilename(imageBaseName, values, result.ext);
			if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
				let shared = false;
				if (typeof navigator.canShare === 'function') {
					try {
						const file = new File([result.blob], filename, { type: result.mime });
						if (navigator.canShare({ files: [file] })) {
							await navigator.share({ files: [file], title: 'VelociView overlay' });
							shared = true;
						}
					} catch {
						// ignore share errors and continue to url fallback
					}
				}
				if (!shared) {
					const url = URL.createObjectURL(result.blob);
					try {
						await navigator.share({ title: 'VelociView overlay', url });
					} finally {
						URL.revokeObjectURL(url);
					}
				}
			} else {
				const url = URL.createObjectURL(result.blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			}
		} finally {
			sharing = false;
		}
	}

	async function copyImageToClipboard(): Promise<void> {
		if (copying) return;
		copying = true;
		justCopied = false;
		try {
			await Promise.all([ensureFontsReady(), ensureWatermarkReady()]);
			const initial = await renderToCanvasAndBlob(exportFormat);
			if (!initial) return;
			if (!canCopyToClipboard || !clipboardItemCtor) {
				await exportImage();
				return;
			}
			const ctor: ClipboardItemCtor = clipboardItemCtor;
			const tryWrite = async (b: Blob, mimeType: string): Promise<boolean> => {
				try {
					const item = new ctor({ [mimeType]: b });
					await navigator.clipboard.write([item]);
					return true;
				} catch {
					return false;
				}
			};
			let success = await tryWrite(initial.blob, initial.mime);
			if (!success && initial.mime !== 'image/png') {
				const pngRes = await renderToCanvasAndBlob('png');
				if (pngRes) {
					success = await tryWrite(pngRes.blob, 'image/png');
				}
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

	const presetMargin = 0.05; // normalized margin from edges

	function applyPositionPreset(preset: PositionPreset): void {
		const { x, y } = presetToPosition(preset, presetMargin);
		posX = x;
		posY = y;
		positionPreset = preset;
		requestRender();
	}
</script>

<section class="space-y-6">
	<div class="mb-8">
		<h2 class="text-xl font-semibold tracking-tight">
			Customizable Strava‑style activity stats generator
		</h2>
		<p class="mt-1 text-sm text-muted">
			VelociView turns your workouts into clean, shareable overlays. Upload a photo and a
			<code>.tcx</code> or <code>.gpx</code> file, pick the stats you want, then fine‑tune layout and
			appearance to match your style.
		</p>

		{#if values?.trackName || values?.trackDescription}
			<div
				class="mt-4 rounded-lg border border-border bg-white/40 p-4 backdrop-blur [[data-theme=dark]_&]:bg-zinc-900/40"
			>
				{#if values.trackName}
					<h3 class="font-semibold text-foreground">{values.trackName}</h3>
				{/if}
				{#if values.trackDescription}
					<p class="mt-1 text-sm text-muted">{values.trackDescription}</p>
				{/if}
			</div>
		{/if}
	</div>
	<div class="grid items-start gap-6 lg:grid-cols-2">
		<ControlsCard
			{imageLoading}
			{tcxLoading}
			{values}
			{imageBitmap}
			bind:imageInputEl
			bind:tcxInputEl
			onImageChange={handleImageChange}
			onTcxChange={handleTcxChange}
			onResetClick={resetAll}
			{selectedFields}
			onFieldsChange={(next) => {
				selectedFields = next;
				requestRender();
			}}
			{positionPreset}
			onPresetChange={(value) => {
				if (value !== 'custom') applyPositionPreset(value as PositionPreset);
			}}
			{gridMode}
			{gridColumns}
			{gridGapScale}
			onLayoutChange={({ gridMode: m, gridColumns: c, gridGapScale: g }) => {
				gridMode = m;
				gridColumns = c;
				gridGapScale = g;
				requestRender();
			}}
			{fontFamily}
			{scale}
			{backdropOpacity}
			{textAlign}
			onFontSelect={(entry) => {
				const needsQuote = /\s/.test(entry.family);
				const first = needsQuote ? `"${entry.family}"` : entry.family;
				fontFamily = `${first}, ${entry.fallback}`;
				ensureFontLoaded(entry.family).then(() => requestRender());
				requestRender();
			}}
			onScaleChange={(v) => {
				scale = v;
				requestRender();
			}}
			onBackdropOpacityChange={(v) => {
				backdropOpacity = v;
				requestRender();
			}}
			onTextAlignChange={(v) => {
				textAlign = v;
				requestRender();
			}}
			{exportFormat}
			{exportQuality}
			onExportOptionsChange={({ exportFormat: f, exportQuality: q }) => {
				exportFormat = f;
				exportQuality = q;
			}}
			{canCopyToClipboard}
			{canShare}
			{copying}
			{sharing}
			{justCopied}
			onExportClick={exportImage}
			onCopyClick={copyImageToClipboard}
			onShareClick={shareImage}
		/>

		<PreviewCard
			bind:this={previewRef}
			hasImage={Boolean(imageUrl)}
			loading={imageLoading || tcxLoading}
			{imageBitmap}
			{values}
			{backdropOpacity}
			{selectedFields}
			{posX}
			{posY}
			{scale}
			{fontFamily}
			{textAlign}
			{gridMode}
			{gridColumns}
			{gridGapScale}
			bind:containerEl={previewCardEl}
			bind:previewCanvasEl
			onRendered={() => {
				if (floatingVisible) scheduleMirror();
			}}
			onPositionChange={({ x, y }) => {
				posX = x;
				posY = y;
				positionPreset = 'custom';
			}}
		/>
		<canvas bind:this={canvasEl} class="hidden"></canvas>
	</div>
</section>

<FloatingPreviewButton
	visible={floatingVisible}
	bind:floatingCanvasEl
	onClick={scrollPreviewIntoView}
/>

<DropOverlay visible={isDragActivePage} />
