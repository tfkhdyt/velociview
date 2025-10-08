import { parseGPX } from '@we-gold/gpxjs';
import {
	calculatePointDistance,
	formatDistance,
	formatDuration,
	formatElevation,
	formatPace,
	formatPaceImperial,
	formatSpeed,
	paceMinPerKm,
	paceMinPerMile
} from './metrics';
import type { StatValues } from './overlay';
import type { UnitSystem } from './units';

/**
 * Parses GPX XML string and extracts activity statistics
 *
 * Security: The @we-gold/gpxjs library uses DOMParser which is safe from XXE
 * (XML External Entity) attacks in modern browsers. The browser's DOMParser
 * does not process external entities or DTDs by default, providing built-in
 * protection against XXE vulnerabilities.
 *
 * @param xmlString - GPX file content as string
 * @returns Parsed activity statistics
 * @throws Error if GPX parsing fails or file is invalid
 */
export interface RawStatValues {
	distanceMeters: number;
	movingTimeSec: number;
	avgSpeedMps: number;
	maxSpeedMps: number;
	ascentM: number;
	descentM: number;
	maxElevationM?: number;
	minElevationM?: number;
	avgElevationM?: number;
	hasElevationData: boolean;
	routePoints?: Array<{ lat: number; lon: number }>;
	trackName?: string;
	trackDescription?: string;
}

export async function parseGpxToRawStats(xmlString: string): Promise<RawStatValues> {
	try {
		const [parsedGPX, error] = parseGPX(xmlString);

		if (error) {
			throw new Error(`GPX parsing failed: ${error.message || 'Invalid GPX format'}`);
		}

		if (!parsedGPX) {
			throw new Error('GPX parsing failed: No data returned from parser');
		}

		// Get the first track (most GPX files have one track)
		const track = parsedGPX.tracks[0];
		if (!track) {
			throw new Error(
				'GPX parsing failed: No tracks found in file. The GPX file may be empty or contain only waypoints.'
			);
		}

		// Validate track has required data
		if (!track.distance?.total && !track.points?.length) {
			throw new Error('GPX parsing failed: Track contains no distance or position data');
		}

		// Distance in meters
		const distanceMeters = track.distance?.total ? track.distance.total : 0;

		// Moving time (in seconds)
		const movingTimeSec = track.duration?.movingDuration || 0;
		// Keep raw seconds for later formatting

		// Calculate speeds (m/s)
		const avgSpeedMps = movingTimeSec > 0 ? (track.distance?.total || 0) / movingTimeSec : 0;

		// Max speed - find from points (optimized for performance)
		let maxSpeedMps = 0;
		const points = track.points || [];
		// Sample points if there are too many (reduces computation time significantly)
		const SAMPLE_INTERVAL = points.length > 1000 ? Math.floor(points.length / 1000) : 1;
		const MAX_REALISTIC_SPEED_MPS = 41.67; // 150 km/h - filters GPS noise

		for (let i = SAMPLE_INTERVAL; i < points.length; i += SAMPLE_INTERVAL) {
			const p1 = points[i - 1];
			const p2 = points[i];
			if (p1?.time && p2?.time && p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
				const timeDiff = (new Date(p2.time).getTime() - new Date(p1.time).getTime()) / 1000;
				// Ignore gaps > 5 seconds to filter out pauses and ensure reasonable time intervals

				if (timeDiff > 0 && timeDiff < 5) {
					const dist = calculatePointDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
					const speed = dist / timeDiff;
					// Filter out GPS noise - speeds > 150 km/h are likely errors for most activities
					if (speed > maxSpeedMps && speed < MAX_REALISTIC_SPEED_MPS) {
						maxSpeedMps = speed;
					}
				}
			}
		}
		// Keep raw m/s for max speed

		// Paces will be computed during formatting according to units

		// Elevation - check if elevation data exists in the GPX file
		const hasElevationData =
			track.elevation &&
			(track.elevation.positive ||
				track.elevation.negative ||
				track.elevation.maximum ||
				track.elevation.minimum);

		const ascentM = track.elevation?.positive || 0;

		const descentM = track.elevation?.negative || 0;

		// Additional elevation metrics (only if elevation data exists)
		const maxElevationM =
			hasElevationData && track.elevation?.maximum ? track.elevation.maximum : undefined;
		const minElevationM =
			hasElevationData && track.elevation?.minimum ? track.elevation.minimum : undefined;
		const avgElevationM =
			hasElevationData && track.elevation?.average ? track.elevation.average : undefined;

		// Route points (GPS coordinates)
		const routePoints = track.points
			?.filter((p) => p.latitude !== undefined && p.longitude !== undefined)
			.map((p) => ({
				lat: p.latitude!,
				lon: p.longitude!
			}));

		// Track metadata
		const trackName = track.name || undefined;
		const trackDescription = track.description || track.comment || undefined;

		return {
			distanceMeters,
			movingTimeSec,
			avgSpeedMps,
			maxSpeedMps,
			ascentM,
			descentM,
			maxElevationM,
			minElevationM,
			avgElevationM,
			hasElevationData: Boolean(hasElevationData),
			routePoints,
			trackName,
			trackDescription
		};
	} catch (error) {
		// Re-throw with context if it's our error
		if (error instanceof Error && error.message.startsWith('GPX parsing failed:')) {
			throw error;
		}
		// Wrap unexpected errors
		throw new Error(
			`Unexpected error parsing GPX: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export function formatStats(raw: RawStatValues, units: UnitSystem): StatValues {
	const distance = formatDistance(raw.distanceMeters, units);
	const movingTime = formatDuration(raw.movingTimeSec);
	const avgSpeed = formatSpeed(raw.avgSpeedMps, units);
	const maxSpeed = formatSpeed(raw.maxSpeedMps, units);

	let avgPace: string | undefined;
	let maxPace: string | undefined;
	if (units === 'imperial') {
		const a = paceMinPerMile(raw.avgSpeedMps);
		avgPace = a > 0 ? formatPaceImperial(a) : undefined;
		const m = raw.maxSpeedMps > 0 ? paceMinPerMile(raw.maxSpeedMps) : 0;
		maxPace = m > 0 ? formatPaceImperial(m) : undefined;
	} else {
		const a = paceMinPerKm(raw.avgSpeedMps);
		avgPace = a > 0 ? formatPace(a) : undefined;
		const m = raw.maxSpeedMps > 0 ? paceMinPerKm(raw.maxSpeedMps) : 0;
		maxPace = m > 0 ? formatPace(m) : undefined;
	}

	const ascent = formatElevation(raw.ascentM, units);
	const descent = formatElevation(raw.descentM, units);
	const maxElevation =
		raw.maxElevationM !== undefined ? formatElevation(raw.maxElevationM, units) : undefined;
	const minElevation =
		raw.minElevationM !== undefined ? formatElevation(raw.minElevationM, units) : undefined;
	const avgElevation =
		raw.avgElevationM !== undefined ? formatElevation(raw.avgElevationM, units) : undefined;

	return {
		distance,
		movingTime,
		avgSpeed,
		maxSpeed,
		avgPace,
		maxPace,
		ascent,
		descent,
		maxElevation,
		minElevation,
		avgElevation,
		routePoints: raw.routePoints,
		trackName: raw.trackName,
		trackDescription: raw.trackDescription
	};
}

// Backward compatibility: default to metric formatting
export async function parseGpxToOverlayValues(xmlString: string): Promise<StatValues> {
	const raw = await parseGpxToRawStats(xmlString);
	return formatStats(raw, 'metric');
}
