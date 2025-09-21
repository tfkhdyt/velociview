<script lang="ts">
	import {
		renderOverlay,
		type OverlayField,
		type OverlayOptions,
		type StatValues
	} from '$lib/overlay';
	import { onMount } from 'svelte';

	let {
		hasImage,
		imageBitmap,
		values,
		// show loading overlay when image or tcx is processing
		loading = false,
		backdropOpacity,
		selectedFields,
		posX,
		posY,
		scale,
		fontFamily,
		textAlign,
		gridMode,
		gridColumns,
		gridGapScale,
		// expose elements to parent
		containerEl = $bindable(),
		previewCanvasEl = $bindable(),
		onPositionChange,
		onRendered
	}: {
		hasImage: boolean;
		imageBitmap: ImageBitmap | null;
		values: StatValues | null;
		loading?: boolean;
		backdropOpacity: number;
		selectedFields: OverlayField[];
		posX: number;
		posY: number;
		scale: number;
		fontFamily: string;
		textAlign: 'left' | 'center' | 'right';
		gridMode: 'list' | 'auto' | 'fixed';
		gridColumns: number;
		gridGapScale: number;
		containerEl?: HTMLDivElement | null;
		previewCanvasEl?: HTMLCanvasElement | null;
		onPositionChange: (pos: { x: number; y: number }) => void;
		onRendered?: () => void;
	} = $props();

	let previewCtx: CanvasRenderingContext2D | null = null;

	let dragging = $state(false);
	let dragAnchorOffsetCanvas = $state({ x: 0, y: 0 });
	let overlayBoxWidth = $state(0);
	let overlayBoxHeight = $state(0);
	let showCenterGuideV = $state(false);
	let showCenterGuideH = $state(false);
	const SNAP_THRESHOLD_PX = 10;

	function ensureContext(): void {
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

	function renderPreview(): void {
		ensureContext();
		if (!imageBitmap || !previewCtx || !previewCanvasEl) return;

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

		if (dragging && (showCenterGuideV || showCenterGuideH)) {
			previewCtx.save();
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
			const w = previewWidth;
			const h = previewHeight;
			if (showCenterGuideV) {
				const x = Math.round(w / 2) + 0.5;
				previewCtx.beginPath();
				previewCtx.moveTo(x, 0);
				previewCtx.lineTo(x, h);
				previewCtx.stroke();
			}
			if (showCenterGuideH) {
				const y = Math.round(h / 2) + 0.5;
				previewCtx.beginPath();
				previewCtx.moveTo(0, y);
				previewCtx.lineTo(w, y);
				previewCtx.stroke();
			}
			previewCtx.restore();
		}

		// Notify parent that a render just completed
		onRendered?.();
	}

	export function requestRender(): void {
		// schedule after state settles
		setTimeout(() => renderPreview(), 10);
	}

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

		const overlayCenterX = topLeftX + boxW / 2;
		const overlayCenterY = topLeftY + boxH / 2;
		const canvasCenterX = canvasW / 2;
		const canvasCenterY = canvasH / 2;

		showCenterGuideV = Math.abs(overlayCenterX - canvasCenterX) <= SNAP_THRESHOLD_PX;
		showCenterGuideH = Math.abs(overlayCenterY - canvasCenterY) <= SNAP_THRESHOLD_PX;

		if (showCenterGuideV) topLeftX = canvasCenterX - boxW / 2;
		if (showCenterGuideH) topLeftY = canvasCenterY - boxH / 2;
		topLeftX = Math.max(0, Math.min(availW, topLeftX));
		topLeftY = Math.max(0, Math.min(availH, topLeftY));
		const nextX = topLeftX / availW;
		const nextY = topLeftY / availH;
		onPositionChange({ x: nextX, y: nextY });
		requestRender();
	}

	function handlePointerUp(e: PointerEvent): void {
		if (previewCanvasEl) {
			try {
				previewCanvasEl.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
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

	onMount(() => {
		requestRender();
	});
</script>

<div
	class="rounded-2xl border border-border bg-white/30 p-4 shadow-lg backdrop-blur-md duration-200 [[data-theme=dark]_&]:bg-zinc-900/30"
	role="region"
	aria-label="Preview"
	bind:this={containerEl}
>
	<h2 class="mb-4 text-base font-semibold tracking-tight">Preview</h2>
	{#if hasImage}
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
			{#if loading}
				<div
					class="absolute inset-0 z-10 grid place-items-center rounded-lg bg-white/60 [[data-theme=dark]_&]:bg-zinc-900/60"
				>
					<svg
						class="h-7 w-7 animate-spin text-accent"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
						></path>
					</svg>
				</div>
			{/if}
		</div>
	{:else}
		<div
			class="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted"
		>
			Your image will be shown here.
		</div>
	{/if}
</div>
