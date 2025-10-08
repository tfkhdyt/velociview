import { parseGPX } from '@we-gold/gpxjs';
import {
	calculatePointDistance,
	formatDuration,
	formatNumber,
	formatPace,
	paceMinPerKm,
	speedToKmh
} from './metrics';
import type { StatValues } from './overlay';

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
export async function parseGpxToOverlayValues(xmlString: string): Promise<StatValues> {
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

		// Distance (convert from meters to km)
		const distanceKm = track.distance?.total ? track.distance.total / 1000 : 0;
		const distance = `${formatNumber(distanceKm, 2)} km`;

		// Moving time (in seconds)
		const movingTimeSec = track.duration?.movingDuration || 0;
		const movingTime = formatDuration(movingTimeSec);

		// Calculate speeds
		const avgSpeedMps = movingTimeSec > 0 ? (track.distance?.total || 0) / movingTimeSec : 0;
		const avgSpeedKmh = speedToKmh(avgSpeedMps);
		const avgSpeed = `${formatNumber(avgSpeedKmh, 1)} km/h`;

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
		const maxSpeedKmh = speedToKmh(maxSpeedMps);
		const maxSpeed = `${formatNumber(maxSpeedKmh, 1)} km/h`;

		// Pace
		const avgPaceMinPerKm = paceMinPerKm(avgSpeedMps);
		const avgPace = avgPaceMinPerKm > 0 ? formatPace(avgPaceMinPerKm) : undefined;

		const maxPaceMinPerKm = maxSpeedMps > 0 ? paceMinPerKm(maxSpeedMps) : 0;
		const maxPace = maxPaceMinPerKm > 0 ? formatPace(maxPaceMinPerKm) : undefined;

		// Elevation - check if elevation data exists in the GPX file
		const hasElevationData =
			track.elevation &&
			(track.elevation.positive ||
				track.elevation.negative ||
				track.elevation.maximum ||
				track.elevation.minimum);

		const ascent = track.elevation?.positive
			? `${formatNumber(track.elevation.positive, 0)} m`
			: hasElevationData
				? '0 m'
				: 'N/A';

		const descentVal = track.elevation?.negative || 0;
		const descent =
			descentVal > 0 ? `${formatNumber(descentVal, 0)} m` : hasElevationData ? '0 m' : 'N/A';

		// Additional elevation metrics (only if elevation data exists)
		const maxElevation =
			hasElevationData && track.elevation?.maximum
				? `${formatNumber(track.elevation.maximum, 0)} m`
				: undefined;
		const minElevation =
			hasElevationData && track.elevation?.minimum
				? `${formatNumber(track.elevation.minimum, 0)} m`
				: undefined;
		const avgElevation =
			hasElevationData && track.elevation?.average
				? `${formatNumber(track.elevation.average, 0)} m`
				: undefined;

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
