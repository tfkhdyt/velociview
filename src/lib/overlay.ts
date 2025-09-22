export type OverlayField =
	| 'distance'
	| 'movingTime'
	| 'avgSpeed'
	| 'maxSpeed'
	| 'avgPace'
	| 'maxPace'
	| 'ascent'
	| 'descent';

export const OVERLAY_FIELD_ORDER: readonly OverlayField[] = [
	'distance',
	'movingTime',
	'avgSpeed',
	'maxSpeed',
	'avgPace',
	'maxPace',
	'ascent',
	'descent'
] as const;

export interface OverlayOptions {
	selectedFields: OverlayField[];
	position: { x: number; y: number }; // top-left in normalized 0..1 coordinates
	scale: number; // relative scale where 1 = baseline font size
	fontFamily: string;
	primaryColor: string;
	secondaryColor: string;
	backgroundMode: 'transparent' | 'dark';
	backgroundOpacity: number; // 0..1 when backgroundMode === 'dark'
	textAlign: 'left' | 'center' | 'right';
	// Grid layout controls. Default behavior is a vertical list ('list').
	gridMode?: 'list' | 'auto' | 'fixed';
	// Used when gridMode === 'fixed'. Values less than 1 will be coerced to 1.
	gridColumns?: number;
	// Scales spacing between grid rows/columns; only used for grid modes.
	// 1 = default spacing, 0 = no gap, 2 = double gap, etc.
	gridGapScale?: number;
}

export interface StatValues {
	// All values are pre-formatted display strings
	distance: string;
	movingTime: string;
	avgSpeed: string;
	maxSpeed: string;
	avgPace?: string;
	maxPace?: string;
	ascent: string;
	descent: string;
}

export interface RenderResult {
	width: number;
	height: number;
	// Top-left corner of the rendered overlay box in pixels
	x: number;
	y: number;
}

// Centralized label mapping for all overlay fields
export function getOverlayFieldLabel(field: OverlayField): string {
	switch (field) {
		case 'distance':
			return 'Distance';
		case 'movingTime':
			return 'Duration';
		case 'avgSpeed':
			return 'Average Speed';
		case 'maxSpeed':
			return 'Max Speed';
		case 'avgPace':
			return 'Average Pace';
		case 'maxPace':
			return 'Max Pace';
		case 'ascent':
			return 'Ascent';
		case 'descent':
			return 'Descent';
	}
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	radius: number
): void {
	const r = Math.min(radius, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

interface OverlayItem {
	label: string;
	value: string;
}

function layoutItems(values: StatValues, fields: OverlayField[]): OverlayItem[] {
	const items: OverlayItem[] = [];
	// Ensure consistent ordering regardless of incoming field order
	const sortedFields = [...fields].sort(
		(a, b) => OVERLAY_FIELD_ORDER.indexOf(a) - OVERLAY_FIELD_ORDER.indexOf(b)
	);
	for (const field of sortedFields) {
		switch (field) {
			case 'distance':
				items.push({ label: getOverlayFieldLabel(field), value: values.distance });
				break;
			case 'movingTime':
				items.push({ label: getOverlayFieldLabel(field), value: values.movingTime });
				break;
			case 'ascent':
				items.push({ label: getOverlayFieldLabel(field), value: values.ascent });
				break;
			case 'descent':
				items.push({ label: getOverlayFieldLabel(field), value: values.descent });
				break;
			case 'avgSpeed':
				items.push({ label: getOverlayFieldLabel(field), value: values.avgSpeed });
				break;
			case 'maxSpeed':
				items.push({ label: getOverlayFieldLabel(field), value: values.maxSpeed });
				break;
			case 'avgPace':
				if (values.avgPace !== undefined) {
					items.push({ label: getOverlayFieldLabel(field), value: values.avgPace });
				}
				break;
			case 'maxPace':
				if (values.maxPace !== undefined) {
					items.push({ label: getOverlayFieldLabel(field), value: values.maxPace });
				}
				break;
		}
	}
	return items;
}

export function renderOverlay(
	ctx: CanvasRenderingContext2D,
	imageWidth: number,
	imageHeight: number,
	values: StatValues,
	opts: OverlayOptions
): RenderResult {
	function quoteFirstFamilyIfNeeded(families: string): string {
		const parts = families.split(',');
		if (parts.length === 0) return families;
		const firstRaw = parts[0]!.trim();
		const alreadyQuoted = firstRaw.startsWith('"') || firstRaw.startsWith("'");
		const needsQuote = /\s/.test(firstRaw) && !alreadyQuoted;
		const first = needsQuote ? `"${firstRaw}"` : firstRaw;
		const rest = parts.slice(1).join(',');
		return rest ? `${first},${rest}` : first;
	}

	const canvasFontFamily = quoteFirstFamilyIfNeeded(opts.fontFamily);
	const baseFontSize = 32; // baseline at scale 1
	// Compensate perceived size across different font families using width measurement
	const compensationSample = 'AaGgHhMm0123456789';
	const measurementWeight = 600;
	const baselineFamily = 'Inter, system-ui, Arial, sans-serif';
	// Measure baseline width using Inter
	ctx.save();
	ctx.font = `${measurementWeight} ${baseFontSize}px ${baselineFamily}`;
	const baselineWidth = Math.max(1, ctx.measureText(compensationSample).width);
	// Measure current font width
	ctx.font = `${measurementWeight} ${baseFontSize}px ${canvasFontFamily}`;
	const currentWidth = Math.max(1, ctx.measureText(compensationSample).width);
	ctx.restore();
	// Ratio > 1 means current font is narrower (looks smaller), so scale up
	const widthRatio = baselineWidth / currentWidth;
	const compensation = Math.max(0.85, Math.min(1.2, widthRatio));
	const valueFontSize = Math.max(12, baseFontSize * opts.scale * compensation);
	const labelFontSize = Math.max(10, Math.round(valueFontSize * 0.5));
	const valueFontWeight = 600;
	const labelFontWeight = 400;
	const padding = Math.round(valueFontSize * 0.5);
	const lineGap = Math.round(valueFontSize * 0.45); // gap between items / rows
	const labelGap = Math.round(valueFontSize * 0.2); // gap between label and value
	const cornerRadius = Math.round(valueFontSize * 0.3);

	ctx.save();
	ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
	ctx.textBaseline = 'top';
	ctx.fillStyle = opts.primaryColor;

	const items = layoutItems(values, opts.selectedFields);
	// Measure each item's max text width (between label and value)
	const itemWidths: number[] = [];
	for (const it of items) {
		ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
		const wLabel = ctx.measureText(it.label).width;
		ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
		const wValue = ctx.measureText(it.value).width;
		itemWidths.push(Math.max(wLabel, wValue));
	}

	const perItemHeight = labelFontSize + labelGap + valueFontSize;

	// Determine layout mode
	const layoutMode: 'list' | 'auto' | 'fixed' = opts.gridMode ?? 'list';
	let colCount = 1;
	if (layoutMode === 'fixed') {
		const requested = opts.gridColumns ?? 1;
		const maxAllowed = Math.max(1, items.length);
		colCount = Math.max(1, Math.min(maxAllowed, Math.floor(requested)));
	} else if (layoutMode === 'auto') {
		const n = Math.max(1, items.length);
		// Choose near-square grid, clamped to 1..4 columns for readability
		const suggested = Math.ceil(Math.sqrt(n));
		colCount = Math.max(1, Math.min(4, suggested));
	}

	// Compute box size
	let boxWidth = 0;
	let boxHeight = 0;
	if (layoutMode === 'list' || colCount === 1) {
		// Vertical list
		const maxWidth = itemWidths.length ? Math.max(...itemWidths) : 0;
		const contentHeight = items.length
			? items.reduce(
					(acc, _it, idx) => acc + perItemHeight + (idx < items.length - 1 ? lineGap : 0),
					0
				)
			: 0;
		boxWidth = Math.ceil(maxWidth) + padding * 2;
		boxHeight = Math.ceil(contentHeight) + padding * 2;
	} else {
		// Grid
		const n = items.length;
		const columns = Math.max(1, colCount);
		const rows = Math.max(1, Math.ceil(n / columns));
		const gapGrid = Math.max(0, Math.round(lineGap * (opts.gridGapScale ?? 1)));

		// Build per-row assignments; for right alignment, place last row in rightmost columns
		const assignments: Array<Array<number | null>> = [];
		for (let r = 0; r < rows; r++) {
			const rowBase = r * columns;
			const remaining = Math.max(0, n - rowBase);
			const itemsInRow = Math.min(columns, remaining);
			const rowAssign: Array<number | null> = new Array(columns).fill(null);
			const isLastRow = r === rows - 1;
			const startCol =
				isLastRow && opts.textAlign === 'right' && itemsInRow < columns ? columns - itemsInRow : 0;
			for (let k = 0; k < itemsInRow; k++) {
				rowAssign[startCol + k] = rowBase + k;
			}
			assignments.push(rowAssign);
		}

		// Compute column widths based on assignments
		const colWidths: number[] = new Array(columns).fill(0);
		for (let c = 0; c < columns; c++) {
			for (let r = 0; r < rows; r++) {
				const idx = assignments[r]![c];
				if (idx !== null && idx !== undefined) {
					colWidths[c] = Math.max(colWidths[c], itemWidths[idx] ?? 0);
				}
			}
		}

		const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
		const totalColGaps = (columns - 1) * gapGrid;
		boxWidth = padding * 2 + totalColsWidth + totalColGaps;
		const totalRowsHeight = rows * perItemHeight;
		const totalRowGaps = (rows - 1) * gapGrid;
		boxHeight = padding * 2 + totalRowsHeight + totalRowGaps;
	}

	const x = Math.round(opts.position.x * (imageWidth - boxWidth));
	const y = Math.round(opts.position.y * (imageHeight - boxHeight));

	if (opts.backgroundMode === 'dark') {
		ctx.globalAlpha = Math.max(0, Math.min(1, opts.backgroundOpacity));
		ctx.fillStyle = opts.secondaryColor;
		drawRoundedRect(ctx, x, y, boxWidth, boxHeight, cornerRadius);
		ctx.fill();
		ctx.globalAlpha = 1;
	}

	ctx.fillStyle = opts.primaryColor;
	let cursorY = y + padding;

	const modeForRender = layoutMode === 'list' || boxWidth === 0 ? 'list' : 'grid';
	if (modeForRender === 'list') {
		// Determine horizontal text anchor and alignment inside the box
		let textX: number;
		switch (opts.textAlign) {
			case 'center':
				ctx.textAlign = 'center';
				textX = x + Math.round(boxWidth / 2);
				break;
			case 'right':
				ctx.textAlign = 'right';
				textX = x + boxWidth - padding;
				break;
			case 'left':
			default:
				ctx.textAlign = 'left';
				textX = x + padding;
				break;
		}
		for (const it of items) {
			// label
			ctx.globalAlpha = 0.85;
			ctx.font = `${labelFontWeight} ${labelFontSize}px ${opts.fontFamily}`;
			ctx.fillText(it.label, textX, cursorY);
			cursorY += labelFontSize + labelGap;

			// value
			ctx.globalAlpha = 1;
			ctx.font = `${valueFontWeight} ${valueFontSize}px ${opts.fontFamily}`;
			ctx.fillText(it.value, textX, cursorY);
			cursorY += valueFontSize + lineGap;
		}
	} else {
		// Grid render
		const n = items.length;
		const columns = Math.max(1, colCount);
		const rows = Math.max(1, Math.ceil(n / columns));
		const gapGrid = Math.max(0, Math.round(lineGap * (opts.gridGapScale ?? 1)));

		// Rebuild assignments (must mirror sizing logic). For right alignment, place last row right.
		const assignments: Array<Array<number | null>> = [];
		for (let r = 0; r < rows; r++) {
			const rowBase = r * columns;
			const remaining = Math.max(0, n - rowBase);
			const itemsInRow = Math.min(columns, remaining);
			const rowAssign: Array<number | null> = new Array(columns).fill(null);
			const isLastRow = r === rows - 1;
			const startCol =
				isLastRow && opts.textAlign === 'right' && itemsInRow < columns ? columns - itemsInRow : 0;
			for (let k = 0; k < itemsInRow; k++) {
				rowAssign[startCol + k] = rowBase + k;
			}
			assignments.push(rowAssign);
		}

		// Compute per-column widths and offsets
		const colWidths: number[] = new Array(columns).fill(0);
		for (let c = 0; c < columns; c++) {
			for (let r = 0; r < rows; r++) {
				const idx = assignments[r]![c];
				if (idx !== null && idx !== undefined) {
					colWidths[c] = Math.max(colWidths[c], itemWidths[idx] ?? 0);
				}
			}
		}
		const colOffsets: number[] = new Array(columns).fill(0);
		for (let c = 1; c < columns; c++) {
			colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGrid;
		}

		// Compute per-row start offset to align row content within total grid width
		const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
		const totalColGapsAll = Math.max(0, (columns - 1) * gapGrid);
		const totalGridWidth = totalColsWidth + totalColGapsAll;
		const rowStartOffset: number[] = new Array(rows).fill(0);
		for (let r = 0; r < rows; r++) {
			// Determine which columns are occupied in this row (from left)
			let itemsInRow = 0;
			for (let c = 0; c < columns; c++) if (assignments[r]![c] != null) itemsInRow++;
			const rowContentWidth =
				colWidths.reduce(
					(acc, w, c) => (assignments[r]![c] != null ? acc + Math.ceil(w) : acc),
					0
				) +
				Math.max(0, itemsInRow - 1) * gapGrid;
			const leftover = Math.max(0, totalGridWidth - rowContentWidth);
			switch (opts.textAlign) {
				case 'right':
					// Keep grid alignment; do not shift the last row
					rowStartOffset[r] = 0;
					break;
				case 'center':
					// Center last row within the grid width
					rowStartOffset[r] = Math.round(leftover / 2);
					break;
				case 'left':
				default:
					rowStartOffset[r] = 0;
			}
		}

		// Set text alignment once; per-cell textX will incorporate alignment
		switch (opts.textAlign) {
			case 'center':
				ctx.textAlign = 'center';
				break;
			case 'right':
				ctx.textAlign = 'right';
				break;
			case 'left':
			default:
				ctx.textAlign = 'left';
				break;
		}

		for (let r = 0; r < rows; r++) {
			const rowTop = y + padding + r * (perItemHeight + gapGrid);
			for (let c = 0; c < columns; c++) {
				const idx = assignments[r]![c];
				if (idx === null || idx === undefined) continue;
				const it = items[idx];
				const thisColWidth = Math.ceil(colWidths[c]);

				// Compute textX based on alignment within this cell/column
				let textX: number;
				switch (opts.textAlign) {
					case 'center':
						textX = x + padding + rowStartOffset[r] + colOffsets[c] + Math.round(thisColWidth / 2);
						break;
					case 'right':
						textX = x + padding + rowStartOffset[r] + colOffsets[c] + thisColWidth;
						break;
					case 'left':
					default:
						textX = x + padding + rowStartOffset[r] + colOffsets[c];
						break;
				}

				// label
				ctx.globalAlpha = 0.85;
				ctx.font = `${labelFontWeight} ${labelFontSize}px ${opts.fontFamily}`;
				ctx.fillText(it.label, textX, rowTop);

				// value
				ctx.globalAlpha = 1;
				ctx.font = `${valueFontWeight} ${valueFontSize}px ${opts.fontFamily}`;
				ctx.fillText(it.value, textX, rowTop + labelFontSize + labelGap);
			}
		}
	}

	ctx.restore();
	return { width: boxWidth, height: boxHeight, x, y };
}
