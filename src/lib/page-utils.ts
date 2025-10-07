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
	// Only check for TCX-specific MIME type if extension doesn't match
	const type = file.type;
	return type === 'application/vnd.garmin.tcx+xml';
}

export function isGpxFile(file: File): boolean {
	const name = file.name.toLowerCase();
	if (name.endsWith('.gpx')) return true;
	// Only check for GPX-specific MIME type if extension doesn't match
	const type = file.type;
	return type === 'application/gpx+xml';
}

export function isActivityFile(file: File): boolean {
	const name = file.name.toLowerCase();
	const hasValidExtension = name.endsWith('.gpx') || name.endsWith('.tcx');
	const hasValidMime =
		file.type === 'application/vnd.garmin.tcx+xml' ||
		file.type === 'application/gpx+xml' ||
		file.type === 'application/xml' ||
		file.type === 'text/xml';
	return hasValidExtension || hasValidMime;
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
	// Prefer track title from activity file if available
	let base = baseName || 'overlay';
	if (values.trackName && values.trackName.trim().length > 0) {
		// Sanitize track name similar to image base name
		base = values.trackName
			.toLowerCase()
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/^-+|-+$/g, '');
	}

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
	uiFontFamily: string,
	avoidRect?: { x: number; y: number; width: number; height: number }
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

		type Corner = {
			x: number;
			y: number;
			align: 'right-bottom' | 'left-bottom' | 'left-top' | 'right-top';
		};
		const candidates: Corner[] = [
			{
				x: imageWidth - margin - targetW,
				y: imageHeight - margin - targetH,
				align: 'right-bottom'
			},
			{ x: margin, y: imageHeight - margin - targetH, align: 'left-bottom' },
			{ x: margin, y: margin, align: 'left-top' },
			{ x: imageWidth - margin - targetW, y: margin, align: 'right-top' }
		];

		const doesOverlap = (ax: number, ay: number, aw: number, ah: number): boolean => {
			if (!avoidRect) return false;
			const bx = avoidRect.x;
			const by = avoidRect.y;
			const bw = avoidRect.width;
			const bh = avoidRect.height;
			return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
		};

		let chosen = candidates.find((c) => !doesOverlap(c.x, c.y, targetW, targetH));
		if (!chosen) {
			// If all corners overlap, choose the one with smallest intersection area
			let best: { corner: Corner; overlapArea: number } | null = null;
			for (const c of candidates) {
				const bx = avoidRect?.x ?? 0;
				const by = avoidRect?.y ?? 0;
				const bw = avoidRect?.width ?? 0;
				const bh = avoidRect?.height ?? 0;
				const ix = Math.max(0, Math.min(c.x + targetW, bx + bw) - Math.max(c.x, bx));
				const iy = Math.max(0, Math.min(c.y + targetH, by + bh) - Math.max(c.y, by));
				const area = ix * iy;
				if (!best || area < best.overlapArea) best = { corner: c, overlapArea: area };
			}
			chosen = best ? best.corner : candidates[0];
		}
		const dx = chosen.x;
		const dy = chosen.y;

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
	// Measure text box for overlap determination
	ctx.save();
	ctx.font = `600 ${fontSize}px ${primaryFamily}`;
	const metrics = ctx.measureText(text);
	const textW = Math.ceil(metrics.width);
	const textH = Math.ceil(fontSize);
	ctx.restore();

	const textCandidates = [
		{ x: imageWidth - margin - textW, y: imageHeight - margin - textH },
		{ x: margin, y: imageHeight - margin - textH },
		{ x: margin, y: margin },
		{ x: imageWidth - margin - textW, y: margin }
	];
	const fits = (tx: number, ty: number): boolean => {
		if (!avoidRect) return true;
		return !(
			tx < avoidRect.x + avoidRect.width &&
			tx + textW > avoidRect.x &&
			ty < avoidRect.y + avoidRect.height &&
			ty + textH > avoidRect.y
		);
	};
	const chosenText = textCandidates.find((c) => fits(c.x, c.y)) ?? textCandidates[0];
	const x = chosenText.x + textW; // align right for drawing with textAlign 'right'
	const y = chosenText.y + textH; // align bottom for drawing with textBaseline 'bottom'
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

export interface RouteOptions {
	scale: number;
	position: { x: number; y: number };
	color: string;
	lineWidth: number;
}

export function drawRouteOnCanvas(
	ctx: CanvasRenderingContext2D,
	imageWidth: number,
	imageHeight: number,
	routePoints: Array<{ lat: number; lon: number }>,
	options: RouteOptions
): void {
	if (!routePoints || routePoints.length < 2) return;

	// Validate and filter out invalid points
	const validPoints = routePoints.filter(
		(p) =>
			p &&
			typeof p.lat === 'number' &&
			typeof p.lon === 'number' &&
			isFinite(p.lat) &&
			isFinite(p.lon) &&
			p.lat >= -90 &&
			p.lat <= 90 &&
			p.lon >= -180 &&
			p.lon <= 180
	);

	if (validPoints.length < 2) return;

	const { scale: userScale, position, color, lineWidth } = options;

	// Calculate bounds
	const lats = validPoints.map((p) => p.lat);
	const lons = validPoints.map((p) => p.lon);
	const minLat = Math.min(...lats);
	const maxLat = Math.max(...lats);
	const minLon = Math.min(...lons);
	const maxLon = Math.max(...lons);

	const latRange = maxLat - minLat;
	const lonRange = maxLon - minLon;

	if (latRange === 0 || lonRange === 0) return;

	// Add padding (10% margin)
	const padding = 0.1;
	const paddedLatRange = latRange * (1 + 2 * padding);
	const paddedLonRange = lonRange * (1 + 2 * padding);

	// Calculate base scale to fit route in image
	const scaleX = imageWidth / paddedLonRange;
	const scaleY = imageHeight / paddedLatRange;
	const baseScale = Math.min(scaleX, scaleY);

	// Apply user scale factor
	const scale = baseScale * userScale;

	// Calculate route dimensions
	const routeWidth = lonRange * scale;
	const routeHeight = latRange * scale;

	// Apply custom position (normalized 0-1 coordinates)
	// position.x/y = 0.5 means center, 0 means left/top, 1 means right/bottom
	const offsetX = position.x * imageWidth - routeWidth / 2 - minLon * scale;
	const offsetY = position.y * imageHeight + routeHeight / 2 + maxLat * scale; // Flip Y axis

	// Convert lat/lon to canvas pixels
	const toCanvasCoords = (lat: number, lon: number): { x: number; y: number } => ({
		x: lon * scale + offsetX,
		y: -lat * scale + offsetY // Flip Y axis (latitude increases upward)
	});

	ctx.save();

	// Draw route path
	ctx.beginPath();
	const firstPoint = toCanvasCoords(validPoints[0].lat, validPoints[0].lon);
	ctx.moveTo(firstPoint.x, firstPoint.y);

	for (let i = 1; i < validPoints.length; i++) {
		const point = toCanvasCoords(validPoints[i].lat, validPoints[i].lon);
		ctx.lineTo(point.x, point.y);
	}

	// Style the route line with custom color and width
	ctx.strokeStyle = color;
	ctx.lineWidth = Math.max(lineWidth, imageWidth * 0.001 * lineWidth);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Add shadow for better visibility
	ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
	ctx.shadowBlur = Math.max(2, imageWidth * 0.002);
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;

	ctx.stroke();

	// Draw start point (green circle)
	const startPoint = toCanvasCoords(validPoints[0].lat, validPoints[0].lon);
	ctx.beginPath();
	ctx.arc(startPoint.x, startPoint.y, Math.max(5, imageWidth * 0.004), 0, Math.PI * 2);
	ctx.fillStyle = '#00FF00';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
	ctx.shadowBlur = Math.max(3, imageWidth * 0.003);
	ctx.fill();
	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2, imageWidth * 0.0015);
	ctx.stroke();

	// Draw end point (red circle)
	const endPoint = toCanvasCoords(
		validPoints[validPoints.length - 1].lat,
		validPoints[validPoints.length - 1].lon
	);
	ctx.beginPath();
	ctx.arc(endPoint.x, endPoint.y, Math.max(5, imageWidth * 0.004), 0, Math.PI * 2);
	ctx.fillStyle = '#FF0000';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
	ctx.shadowBlur = Math.max(3, imageWidth * 0.003);
	ctx.fill();
	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2, imageWidth * 0.0015);
	ctx.stroke();

	ctx.restore();
}
