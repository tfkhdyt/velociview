export type OverlayField =
	| 'distance'
	| 'movingTime'
	| 'avgSpeed'
	| 'maxSpeed'
	| 'avgPace'
	| 'maxPace'
	| 'ascent'
	| 'descent'
	| 'maxElevation'
	| 'minElevation'
	| 'avgElevation'
	| 'routeMap';

export const OVERLAY_FIELD_ORDER: readonly OverlayField[] = [
	'distance',
	'movingTime',
	'avgSpeed',
	'maxSpeed',
	'avgPace',
	'maxPace',
	'ascent',
	'descent',
	'maxElevation',
	'minElevation',
	'avgElevation',
	'routeMap'
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
	// Scales spacing between grid columns; only used for grid modes.
	// 1 = default spacing, 0 = no gap, 2 = double gap, etc.
	gridGapX?: number;
	// Scales spacing between grid rows; only used for grid modes.
	// 1 = default spacing, 0 = no gap, 2 = double gap, etc.
	gridGapY?: number;
	// Map position when route map is enabled
	mapPosition?: 'top' | 'left' | 'right' | 'bottom' | 'grid';
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
	maxElevation?: string;
	minElevation?: string;
	avgElevation?: string;
	// GPS route data
	routePoints?: Array<{ lat: number; lon: number }>;
	// Track metadata
	trackName?: string;
	trackDescription?: string;
}

export interface RenderResult {
	width: number;
	height: number;
	// Top-left corner of the rendered overlay box in pixels
	x: number;
	y: number;
}

// Centralized label mapping for all overlay fields
const OVERLAY_FIELD_LABELS: Record<OverlayField, string> = {
	distance: 'Distance',
	movingTime: 'Duration',
	avgSpeed: 'Average Speed',
	maxSpeed: 'Max Speed',
	avgPace: 'Average Pace',
	maxPace: 'Max Pace',
	ascent: 'Uphill',
	descent: 'Downhill',
	maxElevation: 'Max Elevation',
	minElevation: 'Min Elevation',
	avgElevation: 'Average Elevation',
	routeMap: 'Route Map'
};

export function getOverlayFieldLabel(field: OverlayField): string {
	return OVERLAY_FIELD_LABELS[field];
}

// Helper: ensure first font family is quoted if it contains spaces
export function quoteFirstFamilyIfNeeded(families: string): string {
	const parts = families.split(',');
	if (parts.length === 0) return families;
	const firstRaw = parts[0]!.trim();
	const alreadyQuoted = firstRaw.startsWith('"') || firstRaw.startsWith("'");
	const needsQuote = /\s/.test(firstRaw) && !alreadyQuoted;
	const first = needsQuote ? `"${firstRaw}"` : firstRaw;
	const rest = parts.slice(1).join(',');
	return rest ? `${first},${rest}` : first;
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

function drawSmallRouteMap(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	routePoints: Array<{ lat: number; lon: number }>,
	color: string
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

	// Find bounding box
	let minLat = validPoints[0].lat;
	let maxLat = validPoints[0].lat;
	let minLon = validPoints[0].lon;
	let maxLon = validPoints[0].lon;

	for (const p of validPoints) {
		if (p.lat < minLat) minLat = p.lat;
		if (p.lat > maxLat) maxLat = p.lat;
		if (p.lon < minLon) minLon = p.lon;
		if (p.lon > maxLon) maxLon = p.lon;
	}

	const latRange = maxLat - minLat;
	const lonRange = maxLon - minLon;
	const range = Math.max(latRange, lonRange, 0.0001);

	// Add padding
	const padding = 0.1; // 10% padding
	const paddedRange = range * (1 + padding * 2);

	// Convert lat/lon to canvas coordinates
	const toCanvasCoords = (lat: number, lon: number): { x: number; y: number } => {
		const normalizedX = (lon - minLon + range * padding) / paddedRange;
		const normalizedY = (lat - minLat + range * padding) / paddedRange;
		return {
			x: x + normalizedX * width,
			y: y + height - normalizedY * height // Flip Y
		};
	};

	ctx.save();
	ctx.beginPath();
	const firstPoint = toCanvasCoords(validPoints[0].lat, validPoints[0].lon);
	ctx.moveTo(firstPoint.x, firstPoint.y);

	for (let i = 1; i < validPoints.length; i++) {
		const point = toCanvasCoords(validPoints[i].lat, validPoints[i].lon);
		ctx.lineTo(point.x, point.y);
	}

	ctx.strokeStyle = color;
	ctx.lineWidth = Math.max(1, width * 0.015);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.stroke();

	ctx.restore();
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
			case 'maxElevation':
				if (values.maxElevation !== undefined) {
					items.push({ label: getOverlayFieldLabel(field), value: values.maxElevation });
				}
				break;
			case 'minElevation':
				if (values.minElevation !== undefined) {
					items.push({ label: getOverlayFieldLabel(field), value: values.minElevation });
				}
				break;
			case 'avgElevation':
				if (values.avgElevation !== undefined) {
					items.push({ label: getOverlayFieldLabel(field), value: values.avgElevation });
				}
				break;
			case 'routeMap':
				if (values.routePoints && values.routePoints.length > 0) {
					// Special marker for route visualization
					items.push({ label: getOverlayFieldLabel(field), value: '__ROUTE_MAP__' });
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
	// keep function body clean by using the top-level helper below

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
	const valueFontWeight = 700;
	const labelFontWeight = 500;
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
	const routeMapSize = valueFontSize * 4; // Route map will be 4x font size
	for (const it of items) {
		if (it.value === '__ROUTE_MAP__') {
			// Fixed size for route map visualization
			itemWidths.push(routeMapSize);
		} else {
			ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
			const wLabel = ctx.measureText(it.label).width;
			ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
			const wValue = ctx.measureText(it.value).width;
			itemWidths.push(Math.max(wLabel, wValue));
		}
	}

	const perItemHeight = labelFontSize + labelGap + valueFontSize;

	// Helper to assign items into a grid by rows/columns with optional right-aligned last row
	function buildAssignments(
		itemCount: number,
		cols: number,
		textAlign: 'left' | 'center' | 'right'
	): Array<Array<number | null>> {
		const rowsLocal = Math.max(1, Math.ceil(itemCount / Math.max(1, cols)));
		const result: Array<Array<number | null>> = [];
		for (let r = 0; r < rowsLocal; r++) {
			const rowBase = r * cols;
			const remaining = Math.max(0, itemCount - rowBase);
			const itemsInRow = Math.min(cols, remaining);
			const rowAssign: Array<number | null> = new Array(cols).fill(null);
			const isLastRow = r === rowsLocal - 1;
			const startCol =
				isLastRow && textAlign === 'right' && itemsInRow < cols ? cols - itemsInRow : 0;
			for (let k = 0; k < itemsInRow; k++) {
				rowAssign[startCol + k] = rowBase + k;
			}
			result.push(rowAssign);
		}
		return result;
	}

	// Determine layout mode
	const layoutMode: 'list' | 'auto' | 'fixed' = opts.gridMode ?? 'list';
	const mapPosition: 'top' | 'left' | 'right' | 'bottom' | 'grid' = opts.mapPosition ?? 'grid';
	const hasRouteMap = items.some((item) => item.value === '__ROUTE_MAP__');
	const statsItems = items.filter((item) => item.value !== '__ROUTE_MAP__');

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

	if (hasRouteMap && mapPosition !== 'grid') {
		// Special layout with map positioned separately
		const mapSize =
			mapPosition === 'top' || mapPosition === 'bottom' ? routeMapSize * 2.5 : routeMapSize * 2.0; // Smaller for side positions
		const mapWidth = mapSize;
		const mapHeight = mapSize;

		if (statsItems.length > 0) {
			// Calculate stats layout
			const statsCount = statsItems.length;
			const columns = Math.max(1, colCount);
			const rows = Math.max(1, Math.ceil(statsCount / columns));
			const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
			const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

			// Calculate stats item widths
			const statsItemWidths: number[] = [];
			for (const it of statsItems) {
				ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
				const wLabel = ctx.measureText(it.label).width;
				ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
				const wValue = ctx.measureText(it.value).width;
				statsItemWidths.push(Math.max(wLabel, wValue));
			}

			// Build assignments for stats grid
			const assignments: Array<Array<number | null>> = buildAssignments(
				statsCount,
				columns,
				opts.textAlign
			);

			// Compute column widths for stats
			const colWidths: number[] = new Array(columns).fill(0);
			for (let c = 0; c < columns; c++) {
				for (let r = 0; r < rows; r++) {
					const idx = assignments[r]![c];
					if (idx !== null && idx !== undefined) {
						colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
					}
				}
			}

			const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
			const totalColGaps = (columns - 1) * gapGridX;
			const statsGridWidth = totalColsWidth + totalColGaps;
			const statsGridHeight = rows * perItemHeight + (rows - 1) * gapGridY;

			// Calculate total dimensions based on map position
			if (mapPosition === 'top' || mapPosition === 'bottom') {
				boxWidth = Math.max(mapWidth, statsGridWidth) + padding * 2;
				boxHeight = mapHeight + statsGridHeight + lineGap + padding * 2;
			} else {
				// left or right - calculate box size based on actual content layout
				// The box needs to contain both map and stats with proper spacing
				// Content starts at x + padding and extends to accommodate both elements
				const contentWidth = mapWidth + statsGridWidth + lineGap;
				boxWidth = contentWidth + padding * 2;
				boxHeight = Math.max(mapHeight, statsGridHeight) + padding * 2;
			}
		} else {
			// Only route map
			boxWidth = mapWidth + padding * 2;
			boxHeight = mapHeight + padding * 2;
		}
	} else if (layoutMode === 'list' || colCount === 1) {
		// Vertical list
		const maxWidth = itemWidths.length ? Math.max(...itemWidths) : 0;
		const contentHeight = items.length
			? items.reduce((acc, it, idx) => {
					const itemHeight =
						it.value === '__ROUTE_MAP__' ? labelFontSize + labelGap + routeMapSize : perItemHeight;
					return acc + itemHeight + (idx < items.length - 1 ? lineGap : 0);
				}, 0)
			: 0;
		boxWidth = Math.ceil(maxWidth) + padding * 2;
		boxHeight = Math.ceil(contentHeight) + padding * 2;
	} else {
		// Grid
		const n = items.length;
		const columns = Math.max(1, colCount);
		const rows = Math.max(1, Math.ceil(n / columns));
		const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
		const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

		const assignments: Array<Array<number | null>> = buildAssignments(n, columns, opts.textAlign);

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

		// Compute per-row heights (accounting for route maps which are taller)
		const rowHeights: number[] = new Array(rows).fill(perItemHeight);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < columns; c++) {
				const idx = assignments[r]![c];
				if (idx !== null && idx !== undefined) {
					const it = items[idx];
					if (it.value === '__ROUTE_MAP__') {
						const routeMapItemHeight = labelFontSize + labelGap + routeMapSize;
						rowHeights[r] = Math.max(rowHeights[r], routeMapItemHeight);
					}
				}
			}
		}

		const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
		const totalColGaps = (columns - 1) * gapGridX;
		boxWidth = padding * 2 + totalColsWidth + totalColGaps;
		const totalRowsHeight = rowHeights.reduce((acc, h) => acc + h, 0);
		const totalRowGaps = (rows - 1) * gapGridY;
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

	const modeForRender =
		layoutMode === 'list' || (hasRouteMap && mapPosition !== 'grid') || boxWidth === 0
			? 'list'
			: 'grid';
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

		if (hasRouteMap && mapPosition !== 'grid') {
			// Special rendering for positioned map
			if (values.routePoints) {
				const mapSize =
					mapPosition === 'top' || mapPosition === 'bottom'
						? routeMapSize * 2.5
						: routeMapSize * 2.0;
				const mapWidth = mapSize;
				const mapHeight = mapSize;

				let mapX = textX;
				let mapY = cursorY;

				if (mapPosition === 'top') {
					// Map at top
					if (opts.textAlign === 'center') {
						mapX = textX - mapWidth / 2;
					} else if (opts.textAlign === 'right') {
						mapX = textX - mapWidth;
					}
					drawSmallRouteMap(
						ctx,
						mapX,
						mapY,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
					cursorY += mapHeight + lineGap;
				} else if (mapPosition === 'bottom') {
					// Map at bottom - draw stats first using grid layout
					if (statsItems.length > 0) {
						const statsCount = statsItems.length;
						const columns = Math.max(1, colCount);
						const rows = Math.max(1, Math.ceil(statsCount / columns));
						const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
						const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

						// Calculate stats item widths
						const statsItemWidths: number[] = [];
						for (const it of statsItems) {
							ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
							const wLabel = ctx.measureText(it.label).width;
							ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
							const wValue = ctx.measureText(it.value).width;
							statsItemWidths.push(Math.max(wLabel, wValue));
						}

						// Build assignments for stats grid
						const assignments: Array<Array<number | null>> = buildAssignments(
							statsCount,
							columns,
							opts.textAlign
						);

						// Compute column widths for stats
						const colWidths: number[] = new Array(columns).fill(0);
						for (let c = 0; c < columns; c++) {
							for (let r = 0; r < rows; r++) {
								const idx = assignments[r]![c];
								if (idx !== null && idx !== undefined) {
									colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
								}
							}
						}

						// Compute column offsets
						const colOffsets: number[] = new Array(columns).fill(0);
						for (let c = 1; c < columns; c++) {
							colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGridX;
						}

						// Compute total grid width for centering
						const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
						const totalColGaps = (columns - 1) * gapGridX;
						const totalGridWidth = totalColsWidth + totalColGaps;

						// Center the grid within the box
						let gridStartX = textX;
						if (opts.textAlign === 'center') {
							gridStartX = textX - totalGridWidth / 2;
						} else if (opts.textAlign === 'right') {
							gridStartX = textX - totalGridWidth;
						}

						// Render stats grid
						for (let r = 0; r < rows; r++) {
							const rowTop = cursorY;
							for (let c = 0; c < columns; c++) {
								const idx = assignments[r]![c];
								if (idx === null || idx === undefined) continue;
								const it = statsItems[idx];
								const thisColWidth = Math.ceil(colWidths[c]);

								// Compute textX for this cell
								let cellTextX: number;
								switch (opts.textAlign) {
									case 'center':
										cellTextX = gridStartX + colOffsets[c] + Math.round(thisColWidth / 2);
										break;
									case 'right':
										cellTextX = gridStartX + colOffsets[c] + thisColWidth;
										break;
									case 'left':
									default:
										cellTextX = gridStartX + colOffsets[c];
										break;
								}

								// label
								ctx.globalAlpha = 0.85;
								ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.label, cellTextX, rowTop);

								// value
								ctx.globalAlpha = 1;
								ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.value, cellTextX, rowTop + labelFontSize + labelGap);
							}
							cursorY += perItemHeight + gapGridY;
						}
					}

					// Position map at bottom
					mapY = cursorY + lineGap;
					if (opts.textAlign === 'center') {
						mapX = textX - mapWidth / 2;
					} else if (opts.textAlign === 'right') {
						mapX = textX - mapWidth;
					}
					drawSmallRouteMap(
						ctx,
						mapX,
						mapY,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
					return { width: boxWidth, height: boxHeight, x, y };
				} else if (mapPosition === 'left') {
					// Map on left - adjust position based on text alignment
					let adjustedMapX = mapX;
					if (statsItems.length > 0) {
						// Calculate stats grid width for positioning
						const statsCount = statsItems.length;
						const columns = Math.max(1, colCount);
						const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));

						// Calculate stats item widths
						const statsItemWidths: number[] = [];
						for (const it of statsItems) {
							ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
							const wLabel = ctx.measureText(it.label).width;
							ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
							const wValue = ctx.measureText(it.value).width;
							statsItemWidths.push(Math.max(wLabel, wValue));
						}

						// Build assignments for stats grid
						const assignments: Array<Array<number | null>> = buildAssignments(
							statsCount,
							columns,
							opts.textAlign
						);

						// Compute column widths for stats
						const colWidths: number[] = new Array(columns).fill(0);
						for (let c = 0; c < columns; c++) {
							for (let r = 0; r < Math.max(1, Math.ceil(statsCount / columns)); r++) {
								const idx = assignments[r]![c];
								if (idx !== null && idx !== undefined) {
									colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
								}
							}
						}

						const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
						const totalColGaps = (columns - 1) * gapGridX;
						const statsGridWidth = totalColsWidth + totalColGaps;

						if (opts.textAlign === 'center') {
							adjustedMapX = mapX - (mapWidth + statsGridWidth + lineGap) / 2;
						} else if (opts.textAlign === 'right') {
							adjustedMapX = mapX - (mapWidth + statsGridWidth + lineGap);
						}
					}

					drawSmallRouteMap(
						ctx,
						adjustedMapX,
						mapY,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
					// Draw stats to the right using grid layout
					const statsStartX = adjustedMapX + mapWidth + lineGap;
					cursorY = mapY;

					if (statsItems.length > 0) {
						const statsCount = statsItems.length;
						const columns = Math.max(1, colCount);
						const rows = Math.max(1, Math.ceil(statsCount / columns));
						const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
						const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

						// Calculate stats item widths
						const statsItemWidths: number[] = [];
						for (const it of statsItems) {
							ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
							const wLabel = ctx.measureText(it.label).width;
							ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
							const wValue = ctx.measureText(it.value).width;
							statsItemWidths.push(Math.max(wLabel, wValue));
						}

						// Build assignments for stats grid
						const assignments: Array<Array<number | null>> = buildAssignments(
							statsCount,
							columns,
							opts.textAlign
						);

						// Compute column widths for stats
						const colWidths: number[] = new Array(columns).fill(0);
						for (let c = 0; c < columns; c++) {
							for (let r = 0; r < rows; r++) {
								const idx = assignments[r]![c];
								if (idx !== null && idx !== undefined) {
									colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
								}
							}
						}

						// Compute column offsets
						const colOffsets: number[] = new Array(columns).fill(0);
						for (let c = 1; c < columns; c++) {
							colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGridX;
						}

						// Render stats grid
						for (let r = 0; r < rows; r++) {
							const rowTop = cursorY;
							for (let c = 0; c < columns; c++) {
								const idx = assignments[r]![c];
								if (idx === null || idx === undefined) continue;
								const it = statsItems[idx];
								const thisColWidth = Math.ceil(colWidths[c]);

								// Compute textX for this cell
								let cellTextX: number;
								switch (opts.textAlign) {
									case 'center':
										cellTextX = statsStartX + colOffsets[c] + Math.round(thisColWidth / 2);
										break;
									case 'right':
										cellTextX = statsStartX + colOffsets[c] + thisColWidth;
										break;
									case 'left':
									default:
										cellTextX = statsStartX + colOffsets[c];
										break;
								}

								// label
								ctx.globalAlpha = 0.85;
								ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.label, cellTextX, rowTop);

								// value
								ctx.globalAlpha = 1;
								ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.value, cellTextX, rowTop + labelFontSize + labelGap);
							}
							cursorY += perItemHeight + gapGridY;
						}
					}
					return { width: boxWidth, height: boxHeight, x, y };
				} else if (mapPosition === 'right') {
					// Map on right - draw stats first using grid layout
					cursorY = mapY;

					// Calculate stats grid width for positioning
					let statsGridWidth = 0;
					if (statsItems.length > 0) {
						const statsCount = statsItems.length;
						const columns = Math.max(1, colCount);
						const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));

						// Calculate stats item widths
						const statsItemWidths: number[] = [];
						for (const it of statsItems) {
							ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
							const wLabel = ctx.measureText(it.label).width;
							ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
							const wValue = ctx.measureText(it.value).width;
							statsItemWidths.push(Math.max(wLabel, wValue));
						}

						// Build assignments for stats grid
						const assignments: Array<Array<number | null>> = buildAssignments(
							statsCount,
							columns,
							opts.textAlign
						);

						// Compute column widths for stats
						const colWidths: number[] = new Array(columns).fill(0);
						for (let c = 0; c < columns; c++) {
							for (let r = 0; r < Math.max(1, Math.ceil(statsCount / columns)); r++) {
								const idx = assignments[r]![c];
								if (idx !== null && idx !== undefined) {
									colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
								}
							}
						}

						const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
						const totalColGaps = (columns - 1) * gapGridX;
						statsGridWidth = totalColsWidth + totalColGaps;
					}

					// Adjust textX based on alignment for right position
					let adjustedTextX = textX;
					if (opts.textAlign === 'center') {
						adjustedTextX = textX - (statsGridWidth + mapWidth + lineGap) / 2;
					} else if (opts.textAlign === 'right') {
						adjustedTextX = textX - (statsGridWidth + mapWidth + lineGap);
					}

					if (statsItems.length > 0) {
						const statsCount = statsItems.length;
						const columns = Math.max(1, colCount);
						const rows = Math.max(1, Math.ceil(statsCount / columns));
						const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
						const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

						// Calculate stats item widths
						const statsItemWidths: number[] = [];
						for (const it of statsItems) {
							ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
							const wLabel = ctx.measureText(it.label).width;
							ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
							const wValue = ctx.measureText(it.value).width;
							statsItemWidths.push(Math.max(wLabel, wValue));
						}

						// Build assignments for stats grid
						const assignments: Array<Array<number | null>> = buildAssignments(
							statsCount,
							columns,
							opts.textAlign
						);

						// Compute column widths for stats
						const colWidths: number[] = new Array(columns).fill(0);
						for (let c = 0; c < columns; c++) {
							for (let r = 0; r < rows; r++) {
								const idx = assignments[r]![c];
								if (idx !== null && idx !== undefined) {
									colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
								}
							}
						}

						// Compute column offsets
						const colOffsets: number[] = new Array(columns).fill(0);
						for (let c = 1; c < columns; c++) {
							colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGridX;
						}

						// Compute total grid width for map positioning
						const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
						const totalColGaps = (columns - 1) * gapGridX;
						const totalGridWidth = totalColsWidth + totalColGaps;

						// Position map to the right of the grid
						mapX = adjustedTextX + totalGridWidth + lineGap;

						// Render stats grid
						for (let r = 0; r < rows; r++) {
							const rowTop = cursorY;
							for (let c = 0; c < columns; c++) {
								const idx = assignments[r]![c];
								if (idx === null || idx === undefined) continue;
								const it = statsItems[idx];
								const thisColWidth = Math.ceil(colWidths[c]);

								// Compute textX for this cell
								let cellTextX: number;
								switch (opts.textAlign) {
									case 'center':
										cellTextX = adjustedTextX + colOffsets[c] + Math.round(thisColWidth / 2);
										break;
									case 'right':
										cellTextX = adjustedTextX + colOffsets[c] + thisColWidth;
										break;
									case 'left':
									default:
										cellTextX = adjustedTextX + colOffsets[c];
										break;
								}

								// label
								ctx.globalAlpha = 0.85;
								ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.label, cellTextX, rowTop);

								// value
								ctx.globalAlpha = 1;
								ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
								ctx.fillText(it.value, cellTextX, rowTop + labelFontSize + labelGap);
							}
							cursorY += perItemHeight + gapGridY;
						}
					} else {
						// No stats, position map at adjustedTextX
						mapX = adjustedTextX;
					}

					drawSmallRouteMap(
						ctx,
						mapX,
						mapY,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
					return { width: boxWidth, height: boxHeight, x, y };
				}
			}

			// Draw remaining stats for top position
			if (mapPosition === 'top' && statsItems.length > 0) {
				const statsCount = statsItems.length;
				const columns = Math.max(1, colCount);
				const rows = Math.max(1, Math.ceil(statsCount / columns));
				const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
				const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

				// Calculate stats item widths
				const statsItemWidths: number[] = [];
				for (const it of statsItems) {
					ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
					const wLabel = ctx.measureText(it.label).width;
					ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
					const wValue = ctx.measureText(it.value).width;
					statsItemWidths.push(Math.max(wLabel, wValue));
				}

				// Build assignments for stats grid
				const assignments: Array<Array<number | null>> = buildAssignments(
					statsCount,
					columns,
					opts.textAlign
				);

				// Compute column widths for stats
				const colWidths: number[] = new Array(columns).fill(0);
				for (let c = 0; c < columns; c++) {
					for (let r = 0; r < rows; r++) {
						const idx = assignments[r]![c];
						if (idx !== null && idx !== undefined) {
							colWidths[c] = Math.max(colWidths[c], statsItemWidths[idx] ?? 0);
						}
					}
				}

				// Compute column offsets
				const colOffsets: number[] = new Array(columns).fill(0);
				for (let c = 1; c < columns; c++) {
					colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGridX;
				}

				// Compute total grid width for centering
				const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
				const totalColGaps = (columns - 1) * gapGridX;
				const totalGridWidth = totalColsWidth + totalColGaps;

				// Center the grid within the box
				let gridStartX = textX;
				if (opts.textAlign === 'center') {
					gridStartX = textX - totalGridWidth / 2;
				} else if (opts.textAlign === 'right') {
					gridStartX = textX - totalGridWidth;
				}

				// Render stats grid
				for (let r = 0; r < rows; r++) {
					const rowTop = cursorY;
					for (let c = 0; c < columns; c++) {
						const idx = assignments[r]![c];
						if (idx === null || idx === undefined) continue;
						const it = statsItems[idx];
						const thisColWidth = Math.ceil(colWidths[c]);

						// Compute textX for this cell
						let cellTextX: number;
						switch (opts.textAlign) {
							case 'center':
								cellTextX = gridStartX + colOffsets[c] + Math.round(thisColWidth / 2);
								break;
							case 'right':
								cellTextX = gridStartX + colOffsets[c] + thisColWidth;
								break;
							case 'left':
							default:
								cellTextX = gridStartX + colOffsets[c];
								break;
						}

						// label
						ctx.globalAlpha = 0.85;
						ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
						ctx.fillText(it.label, cellTextX, rowTop);

						// value
						ctx.globalAlpha = 1;
						ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
						ctx.fillText(it.value, cellTextX, rowTop + labelFontSize + labelGap);
					}
					cursorY += perItemHeight + gapGridY;
				}
			}
		} else {
			// Regular list rendering
			for (const it of items) {
				// label
				ctx.globalAlpha = 0.85;
				ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
				ctx.fillText(it.label, textX, cursorY);
				cursorY += labelFontSize + labelGap;

				// value or route map
				ctx.globalAlpha = 1;
				if (it.value === '__ROUTE_MAP__' && values.routePoints) {
					// Draw route map
					const mapWidth = routeMapSize;
					const mapHeight = routeMapSize;
					let mapX = textX;
					if (opts.textAlign === 'center') {
						mapX = textX - mapWidth / 2;
					} else if (opts.textAlign === 'right') {
						mapX = textX - mapWidth;
					}
					drawSmallRouteMap(
						ctx,
						mapX,
						cursorY,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
					cursorY += mapHeight + lineGap;
				} else {
					ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
					ctx.fillText(it.value, textX, cursorY);
					cursorY += valueFontSize + lineGap;
				}
			}
		}
	} else {
		// Grid render
		const n = items.length;
		const columns = Math.max(1, colCount);
		const rows = Math.max(1, Math.ceil(n / columns));
		const gapGridX = Math.max(0, Math.round(lineGap * (opts.gridGapX ?? 1)));
		const gapGridY = Math.max(0, Math.round(lineGap * (opts.gridGapY ?? 1)));

		// Rebuild assignments (must mirror sizing logic). For right alignment, place last row right.
		const assignments: Array<Array<number | null>> = buildAssignments(n, columns, opts.textAlign);

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
			colOffsets[c] = colOffsets[c - 1] + Math.ceil(colWidths[c - 1]) + gapGridX;
		}

		// Compute per-row heights (accounting for route maps which are taller)
		const rowHeights: number[] = new Array(rows).fill(perItemHeight);
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < columns; c++) {
				const idx = assignments[r]![c];
				if (idx !== null && idx !== undefined) {
					const it = items[idx];
					if (it.value === '__ROUTE_MAP__') {
						const routeMapItemHeight = labelFontSize + labelGap + routeMapSize;
						rowHeights[r] = Math.max(rowHeights[r], routeMapItemHeight);
					}
				}
			}
		}

		// Compute per-row Y offsets based on accumulated heights
		const rowYOffsets: number[] = new Array(rows).fill(0);
		for (let r = 1; r < rows; r++) {
			rowYOffsets[r] = rowYOffsets[r - 1] + rowHeights[r - 1] + gapGridY;
		}

		// Compute per-row start offset to align row content within total grid width
		const totalColsWidth = colWidths.reduce((acc, w) => acc + Math.ceil(w), 0);
		const totalColGapsAll = Math.max(0, (columns - 1) * gapGridX);
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
				Math.max(0, itemsInRow - 1) * gapGridX;
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
			const rowTop = y + padding + rowYOffsets[r];
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
				ctx.font = `${labelFontWeight} ${labelFontSize}px ${canvasFontFamily}`;
				ctx.fillText(it.label, textX, rowTop);

				// value or route map
				ctx.globalAlpha = 1;
				if (it.value === '__ROUTE_MAP__' && values.routePoints) {
					// Draw route map
					const mapWidth = routeMapSize;
					const mapHeight = routeMapSize;
					let mapX = textX;
					if (opts.textAlign === 'center') {
						mapX = textX - mapWidth / 2;
					} else if (opts.textAlign === 'right') {
						mapX = textX - mapWidth;
					}
					drawSmallRouteMap(
						ctx,
						mapX,
						rowTop + labelFontSize + labelGap,
						mapWidth,
						mapHeight,
						values.routePoints,
						opts.primaryColor
					);
				} else {
					ctx.font = `${valueFontWeight} ${valueFontSize}px ${canvasFontFamily}`;
					ctx.fillText(it.value, textX, rowTop + labelFontSize + labelGap);
				}
			}
		}
	}

	ctx.restore();
	return { width: boxWidth, height: boxHeight, x, y };
}
