// Utility functions and shared types for the +page.svelte route

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

export function drawWatermark(
	ctx: CanvasRenderingContext2D,
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
	ctx.save();
	ctx.textAlign = 'right';
	ctx.textBaseline = 'bottom';
	ctx.font = `italic 600 ${fontSize}px ${primaryFamily}`;
	// Measure for gradient width
	const metrics = ctx.measureText(text);
	const textWidth = Math.ceil(metrics.width);
	// Subtle shadow for legibility (reduced size)
	ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
	ctx.shadowBlur = Math.max(0, Math.round(fontSize * 0.25));
	ctx.shadowOffsetX = Math.round(fontSize * 0.08);
	ctx.shadowOffsetY = Math.round(fontSize * 0.08);
	// Thin stroke to outline (smaller and lighter)
	ctx.lineJoin = 'round';
	ctx.lineWidth = 1;
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.strokeText(text, x, y);
	// Elegant gradient fill (less transparent)
	const grad = ctx.createLinearGradient(x - textWidth, y, x, y);
	grad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
	grad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
	ctx.fillStyle = grad;
	ctx.fillText(text, x, y);
	ctx.restore();
}
