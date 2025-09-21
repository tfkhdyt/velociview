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

	// Manual rendering control - no more reactive dependencies
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
			fontsReady = true;
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

		return () => {
			document.removeEventListener('dragover', handleDocDragOver);
			document.removeEventListener('dragenter', handleDocDragEnter);
			document.removeEventListener('dragleave', handleDocDragLeave);
			document.removeEventListener('drop', handleDocDrop);
		};
	});

	let positionPreset = $state<PositionPreset | 'custom'>('bottom left');

	let values: StatValues | null = $state(null);

	// Loading indicator for TCX parsing
	let tcxLoading: boolean = $state(false);

	// Page-wide dropzone state
	let pageDragCounter = $state(0);
	let isDragActivePage = $state(false);

	// File input references for reset functionality
	let imageInputEl: HTMLInputElement | null = $state(null);
	let tcxInputEl: HTMLInputElement | null = $state(null);

	// Track last measured overlay box size from render to improve drag mapping
	let overlayBoxWidth = $state(0);
	let overlayBoxHeight = $state(0);

	function resetAll(): void {
		// Clear file state
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		imageBitmap = null;
		imageUrl = null;
		imageBaseName = '';
		originalWidth = 0;
		originalHeight = 0;
		values = null;

		// Clear the preview canvas before clearing contexts
		if (previewCanvasEl && previewCtx) {
			previewCtx.clearRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);
		}

		// Clear canvas contexts and force re-creation
		ctx = null;
		previewCtx = null;

		// Clear file input values to ensure onchange fires for new uploads
		if (imageInputEl) imageInputEl.value = '';
		if (tcxInputEl) tcxInputEl.value = '';
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
		// Force immediate render
		requestRender();
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
		const tcx = arr.find((f) => isTcxFile(f));
		if (image) await loadImageFile(image);
		if (tcx) await loadTcxFile(tcx);
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

	function renderPreview(): void {
		// Clamp gridColumns when in fixed mode to the current number of selected fields
		if (gridMode === 'fixed') {
			const maxCols = Math.max(1, selectedFields.length);
			if (gridColumns > maxCols) gridColumns = maxCols;
			if (gridColumns < 1) gridColumns = 1;
		}

		ensureContexts();

		// Check all required conditions
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

		// Draw snapping guides (on top) when dragging near center
		if (dragging && (showCenterGuideV || showCenterGuideH)) {
			previewCtx.save();
			// Try to use theme accent color; fallback to a visible teal
			let accent = '#0ea5a4';
			try {
				const root = document.documentElement;
				const val = getComputedStyle(root).getPropertyValue('--color-accent').trim();
				if (val) accent = val;
			} catch {
				// ignore
			}
			previewCtx.strokeStyle = accent;
			previewCtx.setLineDash([6, 6]);
			previewCtx.lineWidth = 1;
			previewCtx.globalAlpha = 0.85;
			if (showCenterGuideV) {
				const x = Math.round(previewWidth / 2) + 0.5; // crisp line
				previewCtx.beginPath();
				previewCtx.moveTo(x, 0);
				previewCtx.lineTo(x, previewHeight);
				previewCtx.stroke();
			}
			if (showCenterGuideH) {
				const y = Math.round(previewHeight / 2) + 0.5; // crisp line
				previewCtx.beginPath();
				previewCtx.moveTo(0, y);
				previewCtx.lineTo(previewWidth, y);
				previewCtx.stroke();
			}
			previewCtx.restore();
		}
	}

	// Safe render function that handles all the checks
	function requestRender(): void {
		// Use setTimeout to ensure state has settled
		setTimeout(() => renderPreview(), 10);
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

	function drawWatermark(
		ctx2d: CanvasRenderingContext2D,
		imageWidth: number,
		imageHeight: number,
		uiFontFamily: string
	): void {
		const text = 'Made by VelociView';
		const margin = Math.max(8, Math.round(imageWidth * 0.02));
		const fontSize = Math.max(12, Math.min(28, Math.round(imageWidth * 0.016)));
		const primaryFamily = uiFontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
		const x = imageWidth - margin;
		const y = imageHeight - margin;
		ctx2d.save();
		ctx2d.textAlign = 'right';
		ctx2d.textBaseline = 'bottom';
		ctx2d.font = `italic 600 ${fontSize}px ${primaryFamily}`;
		// Measure for gradient width
		const metrics = ctx2d.measureText(text);
		const textWidth = Math.ceil(metrics.width);
		// Subtle shadow for legibility (reduced size)
		ctx2d.shadowColor = 'rgba(0, 0, 0, 0.4)';
		ctx2d.shadowBlur = Math.max(0, Math.round(fontSize * 0.25));
		ctx2d.shadowOffsetX = Math.round(fontSize * 0.08);
		ctx2d.shadowOffsetY = Math.round(fontSize * 0.08);
		// Thin stroke to outline (smaller and lighter)
		ctx2d.lineJoin = 'round';
		ctx2d.lineWidth = 1;
		ctx2d.strokeStyle = 'rgba(0, 0, 0, 0.35)';
		ctx2d.strokeText(text, x, y);
		// Elegant gradient fill (less transparent)
		const grad = ctx2d.createLinearGradient(x - textWidth, y, x, y);
		grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
		grad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
		ctx2d.fillStyle = grad;
		ctx2d.fillText(text, x, y);
		ctx2d.restore();
	}

	// No $effect - we'll handle rendering manually

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
		// Watermark (export only)
		drawWatermark(ctx, originalWidth, originalHeight, fontFamily);
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

	async function shareImage(): Promise<void> {
		if (sharing) return;
		sharing = true;
		try {
			// Ensure web fonts are ready
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
			const previewWidthRef = previewCanvasEl?.width ?? originalWidth;
			const exportScaleFactor = originalWidth / Math.max(1, previewWidthRef);
			const exportOptions: OverlayOptions = {
				...getOverlayOptions(),
				scale: scale * exportScaleFactor
			};
			renderOverlay(ctx, originalWidth, originalHeight, values, exportOptions);
			// Watermark on share as well
			drawWatermark(ctx, originalWidth, originalHeight, fontFamily);
			const { mime, ext } = getMimeAndExt(exportFormat);
			const qualityParam =
				exportFormat === 'png' ? undefined : Math.max(0, Math.min(1, exportQuality));
			const blob: Blob | null = await new Promise((resolve) =>
				c.toBlob(resolve, mime, qualityParam)
			);
			if (!blob) return;
			const filename = buildDownloadFilename(imageBaseName, values, ext);
			if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
				// Prefer files if supported
				let shared = false;
				if (typeof navigator.canShare === 'function') {
					try {
						const file = new File([blob], filename, { type: mime });
						if (navigator.canShare({ files: [file] })) {
							await navigator.share({ files: [file], title: 'VelociView overlay' });
							shared = true;
						}
					} catch {
						// ignore share errors and continue to url fallback
					}
				}
				if (!shared) {
					// Fallback to sharing a blob URL if files not supported
					const url = URL.createObjectURL(blob);
					try {
						await navigator.share({ title: 'VelociView overlay', url });
					} finally {
						URL.revokeObjectURL(url);
					}
				}
			} else {
				// Fallback to normal download if share is unavailable
				const url = URL.createObjectURL(blob);
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
			// Watermark (copy to clipboard)
			drawWatermark(ctx, originalWidth, originalHeight, fontFamily);
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
	// Center snapping state
	let showCenterGuideV = $state(false);
	let showCenterGuideH = $state(false);
	// Threshold in canvas pixels within which overlay center snaps to canvas center
	const SNAP_THRESHOLD_PX = 10;

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

		// Compute center-based snapping
		const overlayCenterX = topLeftX + boxW / 2;
		const overlayCenterY = topLeftY + boxH / 2;
		const canvasCenterX = canvasW / 2;
		const canvasCenterY = canvasH / 2;

		showCenterGuideV = Math.abs(overlayCenterX - canvasCenterX) <= SNAP_THRESHOLD_PX;
		showCenterGuideH = Math.abs(overlayCenterY - canvasCenterY) <= SNAP_THRESHOLD_PX;

		if (showCenterGuideV) {
			// Snap X so that overlay center aligns to canvas center
			topLeftX = canvasCenterX - boxW / 2;
		}
		if (showCenterGuideH) {
			// Snap Y so that overlay center aligns to canvas center
			topLeftY = canvasCenterY - boxH / 2;
		}
		topLeftX = Math.max(0, Math.min(availW, topLeftX));
		topLeftY = Math.max(0, Math.min(availH, topLeftY));
		posX = topLeftX / availW;
		posY = topLeftY / availH;
		positionPreset = 'custom';
		requestRender();
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
		showCenterGuideV = false;
		showCenterGuideH = false;
		requestRender();
	}
	function handlePointerCancel(): void {
		dragging = false;
		showCenterGuideV = false;
		showCenterGuideH = false;
		requestRender();
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
			<code>.tcx</code> file, pick the stats you want, then fine‑tune layout and appearance to match
			your style.
		</p>
	</div>
	<div class="grid items-start gap-6 lg:grid-cols-2">
		<!-- Controls Card -->
		<div
			class="rounded-2xl border border-border bg-white/30 p-5 shadow-lg backdrop-blur-md duration-200 [[data-theme=dark]_&]:bg-zinc-900/30"
			role="region"
			aria-label="Upload controls"
		>
			<h2 class="mb-4 text-base font-semibold tracking-tight">Upload</h2>

			<UploadSection
				{tcxLoading}
				onImageChange={handleImageChange}
				onTcxChange={handleTcxChange}
				bind:imageInputEl
				bind:tcxInputEl
			/>

			{#if values && imageBitmap}
				<hr class="my-6 border-t border-border" />

				<div class="mt-6 space-y-5">
					<h2 class="mb-4 text-base font-semibold tracking-tight">Control</h2>

					<FieldsSelector
						{selectedFields}
						onChange={(next) => {
							selectedFields = next;
							requestRender();
						}}
					/>

					<!-- Reordered controls: Position, Layout, Appearance -->
					<div class="space-y-8 pb-4">
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
								requestRender();
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
									requestRender();
								});
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
						canShare={Boolean(imageBitmap && values && canShare)}
						{copying}
						{sharing}
						{justCopied}
						onExportClick={exportImage}
						onCopyClick={copyImageToClipboard}
						onShareClick={shareImage}
						onResetClick={resetAll}
					/>
				</div>
			{/if}
		</div>

		<!-- Preview Card -->
		<div
			class="rounded-2xl border border-border bg-white/30 p-4 shadow-lg backdrop-blur-md duration-200 [[data-theme=dark]_&]:bg-zinc-900/30"
			role="region"
			aria-label="Preview"
		>
			<h2 class="mb-4 text-base font-semibold tracking-tight">Preview</h2>
			{#if imageUrl}
				<div class="relative">
					<canvas
						bind:this={previewCanvasEl}
						class="h-auto w-full cursor-move touch-none rounded-lg border border-border select-none"
						onpointerdown={handlePointerDown}
						onpointermove={handlePointerMove}
						onpointerup={handlePointerUp}
						onpointercancel={handlePointerCancel}
						oncontextmenu={(e) => e.preventDefault()}
					></canvas>
				</div>
			{:else}
				<div
					class="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted"
				>
					Your image will be shown here.
				</div>
			{/if}
			<canvas bind:this={canvasEl} class="hidden"></canvas>
		</div>
	</div>
</section>

{#if isDragActivePage}
	<div class="pointer-events-none fixed inset-0 z-50">
		<div
			class="absolute inset-0"
			style="background-color: color-mix(in srgb, var(--color-accent) 7%, transparent);"
		></div>
		<div class="absolute inset-0 flex items-center justify-center">
			<div
				class="pointer-events-none rounded-xl border border-dashed border-accent bg-white/40 px-6 py-3 text-sm font-medium text-accent shadow-lg backdrop-blur-md [[data-theme=dark]_&]:bg-zinc-900/40"
			>
				Drop image or .tcx anywhere to load
			</div>
		</div>
	</div>
{/if}
