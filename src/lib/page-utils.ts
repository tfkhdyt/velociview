// Utility functions and shared types for the +page.svelte route

import darkLogoUrl from '$lib/assets/dark-logo.png';
import lightLogoUrl from '$lib/assets/light-logo.png';
import type { StatValues } from '$lib/overlay';

export type PositionPreset =
	| 'top'
	| 'left'
	| 'center'
	| 'right'
	| 'bottom'
	| 'top left'
	| 'top right'
	| 'bottom left'
	| 'bottom right';

export interface GoogleFontEntry {
	label: string;
	family: string;
	css: string;
	fallback: string;
}

export const GOOGLE_FONTS: GoogleFontEntry[] = [
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
	{ label: 'Poppins', family: 'Poppins', css: 'Poppins', fallback: 'system-ui, Arial, sans-serif' },
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

export async function ensureFontLoaded(targetFamily: string): Promise<void> {
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

export function isTcxFile(file: File): boolean {
	const name = file.name.toLowerCase();
	if (name.endsWith('.tcx')) return true;
	const type = file.type;
	return (
		type === 'application/vnd.garmin.tcx+xml' || type === 'application/xml' || type === 'text/xml'
	);
}

export function isImageFile(file: File): boolean {
	return file.type.startsWith('image/');
}

export function getMimeAndExt(fmt: 'png' | 'jpeg' | 'webp'): {
	mime: 'image/png' | 'image/jpeg' | 'image/webp';
	ext: 'png' | 'jpg' | 'webp';
} {
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

export const PRESET_MARGIN = 0.05; // normalized margin from edges

export function presetToPosition(
	preset: PositionPreset,
	margin: number = PRESET_MARGIN
): { x: number; y: number } {
	switch (preset) {
		case 'center':
			return { x: 0.5, y: 0.5 };
		case 'top':
			return { x: 0.5, y: margin };
		case 'bottom':
			return { x: 0.5, y: 1 - margin };
		case 'left':
			return { x: margin, y: 0.5 };
		case 'right':
			return { x: 1 - margin, y: 0.5 };
		case 'top left':
			return { x: margin, y: margin };
		case 'top right':
			return { x: 1 - margin, y: margin };
		case 'bottom left':
			return { x: margin, y: 1 - margin };
		case 'bottom right':
			return { x: 1 - margin, y: 1 - margin };
	}
}

export function buildDownloadFilename(baseName: string, values: StatValues, ext: string): string {
	const base = baseName || 'overlay';
	const distMatch = values.distance.match(/([0-9]+(?:\.[0-9]+)?)/);
	const distPart = distMatch ? `${distMatch[1]}km` : null;
	const timePart = values.movingTime.replace(/[^0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const parts = [base, distPart, timePart].filter((p): p is string => Boolean(p && p.length > 0));
	return `${parts.join('_')}.${ext}`;
}

// Preload and cache the watermark logos for canvas drawing
let lightWatermarkImage: HTMLImageElement | null = null;
let darkWatermarkImage: HTMLImageElement | null = null;
let watermarkReadyPromise: Promise<void> | null = null;

export function ensureWatermarkReady(): Promise<void> {
	// No-op on server or non-DOM environments
	if (typeof Image === 'undefined') return Promise.resolve();

	const lightReady = Boolean(
		lightWatermarkImage && lightWatermarkImage.complete && lightWatermarkImage.naturalWidth > 0
	);
	const darkReady = Boolean(
		darkWatermarkImage && darkWatermarkImage.complete && darkWatermarkImage.naturalWidth > 0
	);
	if (lightReady && darkReady) return Promise.resolve();

	if (!lightWatermarkImage) {
		lightWatermarkImage = new Image();
		lightWatermarkImage.decoding = 'async';
		lightWatermarkImage.loading = 'eager';
		lightWatermarkImage.src = lightLogoUrl;
	}
	if (!darkWatermarkImage) {
		darkWatermarkImage = new Image();
		darkWatermarkImage.decoding = 'async';
		darkWatermarkImage.loading = 'eager';
		darkWatermarkImage.src = darkLogoUrl;
	}

	if (!watermarkReadyPromise) {
		watermarkReadyPromise = new Promise((resolve) => {
			let pending = 0;
			const finish = (): void => {
				if (--pending <= 0) resolve();
			};
			const kick = (img: HTMLImageElement | null): void => {
				if (!img) return finish();
				if (img.complete && img.naturalWidth > 0) return finish();
				img.onload = finish;
				img.onerror = finish; // fail-soft to avoid blocking export
				pending++;
			};
			// Start with 1 so finish works when both are already ready
			pending = 1;
			kick(lightWatermarkImage);
			kick(darkWatermarkImage);
			finish();
		});
	}

	return watermarkReadyPromise;
}

export function drawWatermark(
	ctx: CanvasRenderingContext2D,
	imageWidth: number,
	imageHeight: number,
	uiFontFamily: string
): void {
	const margin = Math.max(8, Math.round(imageWidth * 0.02));
	const hasLight = Boolean(
		lightWatermarkImage && lightWatermarkImage.complete && lightWatermarkImage.naturalWidth > 0
	);
	const hasDark = Boolean(
		darkWatermarkImage && darkWatermarkImage.complete && darkWatermarkImage.naturalWidth > 0
	);

	if (hasLight || hasDark) {
		const aspectSource = hasLight ? lightWatermarkImage! : hasDark ? darkWatermarkImage! : null;
		const aspect = aspectSource
			? aspectSource.naturalWidth / Math.max(1, aspectSource.naturalHeight)
			: 4;
		const targetH = Math.max(14, Math.min(42, Math.round(imageWidth * 0.028)));
		const targetW = Math.max(18, Math.round(targetH * aspect));
		const dx = imageWidth - margin - targetW;
		const dy = imageHeight - margin - targetH;

		let useDark = false;
		try {
			const sx = Math.max(0, Math.floor(dx));
			const sy = Math.max(0, Math.floor(dy));
			const sw = Math.max(1, Math.min(Math.floor(targetW), Math.floor(imageWidth - sx)));
			const sh = Math.max(1, Math.min(Math.floor(targetH), Math.floor(imageHeight - sy)));
			const data = ctx.getImageData(sx, sy, sw, sh).data;
			let sum = 0;
			const pixels = Math.floor(data.length / 4);
			for (let i = 0; i < data.length; i += 4) {
				const r = data[i] as number;
				const g = data[i + 1] as number;
				const b = data[i + 2] as number;
				// Perceptual luminance
				sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
			}
			const avgLuma01 = sum / pixels / 255;
			useDark = avgLuma01 >= 0.6;
		} catch {
			useDark = false;
		}

		const logo = useDark
			? (darkWatermarkImage ?? lightWatermarkImage)
			: (lightWatermarkImage ?? darkWatermarkImage);
		if (logo) {
			ctx.save();
			ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
			ctx.shadowBlur = Math.round(targetH * 0.18);
			ctx.shadowOffsetX = Math.round(targetH * 0.06);
			ctx.shadowOffsetY = Math.round(targetH * 0.06);
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(logo, dx, dy, targetW, targetH);
			ctx.restore();
			return;
		}
	}

	// Fallback to text watermark if logo isn't available
	const text = 'VelociView';
	const fontSize = Math.max(12, Math.min(28, Math.round(imageWidth * 0.016)));
	const primaryFamily = uiFontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter';
	const x = imageWidth - margin;
	const y = imageHeight - margin;
	ctx.save();
	ctx.textAlign = 'right';
	ctx.textBaseline = 'bottom';
	ctx.font = `600 ${fontSize}px ${primaryFamily}`;
	ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
	ctx.shadowBlur = Math.max(0, Math.round(fontSize * 0.25));
	ctx.shadowOffsetX = Math.round(fontSize * 0.08);
	ctx.shadowOffsetY = Math.round(fontSize * 0.08);
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.fillText(text, x, y);
	ctx.restore();
}
