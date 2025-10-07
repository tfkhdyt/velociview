import { SportsLib } from '@sports-alliance/sports-lib';
import type { EventInterface } from '@sports-alliance/sports-lib/lib/events/event.interface';
import { parseGPX } from '@we-gold/gpxjs';
import type { StatValues } from './overlay';

function getStat(holder: EventInterface, type: string): string | number | null {
	const stat = holder.getStat(type);
	if (
		stat &&
		typeof (stat as { getDisplayValue?: () => string | number }).getDisplayValue === 'function'
	) {
		return (stat as { getDisplayValue: () => string | number }).getDisplayValue();
	}
	return null;
}

// Helper: append unit only when value is numeric or unitless string
function withUnitIfNumeric(v: string | number | null, unit: string): string {
	if (v == null) return '';
	if (typeof v === 'number') return `${v} ${unit}`;
	return /[a-zA-Z]/.test(v) ? v : `${v} ${unit}`;
}

// Helper: normalize pace. Keep library string if it already includes units/letters
function normalizePace(v: string | number | null): string | undefined {
	if (v == null) return undefined;
	if (typeof v === 'number') return `${formatPace(v)} /km`;
	return /[a-zA-Z]/.test(v) ? v : `${v} /km`;
}

// Helper: ensure descent is displayed as a negative with single unit suffix
function formatDescent(v: string | number | null): string {
	if (v == null) return '';
	if (typeof v === 'number') {
		const magnitude = Math.abs(v);
		return `-${magnitude} m`;
	}
	const s = String(v).trim();
	const hasLetters = /[a-zA-Z]/.test(s);
	const hasMinus = s.startsWith('-');
	if (hasMinus) {
		return hasLetters ? s : `${s} m`;
	}
	return hasLetters ? `-${s}` : `-${s} m`;
}

function extractStatsFromEvent(event: EventInterface): StatValues {
	const distanceDisplay = (
		event.getDistance() as unknown as {
			getDisplayValue?: () => string | number;
		}
	)?.getDisplayValue?.();
	const distance =
		distanceDisplay == null
			? ''
			: typeof distanceDisplay === 'number'
				? `${distanceDisplay} km`
				: /[a-zA-Z]/.test(String(distanceDisplay))
					? String(distanceDisplay)
					: `${distanceDisplay} km`;

	// Try to get moving time first, fallback to total duration
	const movingTimeStat = getStat(event, 'Moving time');
	const movingTimeVal = movingTimeStat
		? (movingTimeStat as unknown as { getValue?: () => number })?.getValue?.()
		: null;

	// If no moving time stat, use total duration
	const durationVal =
		movingTimeVal ?? (event.getDuration() as unknown as { getValue?: () => number })?.getValue?.();

	const movingTimeRaw = String(
		movingTimeStat
			? (
					movingTimeStat as unknown as { getDisplayValue?: () => string | number }
				)?.getDisplayValue?.()
			: ((
					event.getDuration() as unknown as {
						getDisplayValue?: () => string | number;
					}
				)?.getDisplayValue?.() ?? '')
	);
	const movingTime =
		typeof durationVal === 'number' && isFinite(durationVal)
			? formatDuration(Math.max(0, Math.floor(durationVal)))
			: movingTimeRaw
					.replace(/(\d+)h/, (_, h: string) => `${parseInt(h, 10)}:`)
					.replace(/(\d+)m/, (_, m: string) => `${m.padStart(2, '0')}:`)
					.replace(/(\d+)s/, (_, s: string) => `${s.padStart(2, '0')}`)
					.replace(/\s+/g, '')
					.replace(/:$/, '');

	const avgSpeedStat = getStat(event, 'Average speed in kilometers per hour');
	const maxSpeedStat = getStat(event, 'Maximum speed in kilometers per hour');
	const avgPaceStat = getStat(event, 'Average Pace');
	const maxPaceStat = getStat(event, 'Maximum Pace');
	const ascentStat = getStat(event, 'Ascent');
	const descentStat = getStat(event, 'Descent');

	const avgSpeed = withUnitIfNumeric(avgSpeedStat, 'km/h');
	const maxSpeed = withUnitIfNumeric(maxSpeedStat, 'km/h');
	const avgPace = normalizePace(avgPaceStat);
	const maxPace = normalizePace(maxPaceStat);
	const ascent = withUnitIfNumeric(ascentStat, 'm');
	const descent = formatDescent(descentStat);

	return {
		distance,
		movingTime,
		avgSpeed,
		maxSpeed,
		avgPace,
		maxPace,
		ascent,
		descent
	};
}

export async function parseTcxToOverlayValues(xmlString: string): Promise<StatValues> {
	const parser = new DOMParser();
	const xml = parser.parseFromString(xmlString, 'application/xml');
	const event = await SportsLib.importFromTCX(xml);
	return extractStatsFromEvent(event);
}

export async function parseGpxToOverlayValues(xmlString: string): Promise<StatValues> {
	const [parsedGPX, error] = parseGPX(xmlString);

	if (error || !parsedGPX) {
		throw new Error('Failed to parse GPX file: ' + (error?.message || 'Unknown error'));
	}

	// Get the first track (most GPX files have one track)
	const track = parsedGPX.tracks[0];
	if (!track) {
		throw new Error('No tracks found in GPX file');
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

	// Max speed - find from points
	let maxSpeedMps = 0;
	const points = track.points || [];
	for (let i = 1; i < points.length; i++) {
		const p1 = points[i - 1];
		const p2 = points[i];
		if (p1?.time && p2?.time && p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
			const timeDiff = (new Date(p2.time).getTime() - new Date(p1.time).getTime()) / 1000;
			if (timeDiff > 0) {
				const dist = calculatePointDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
				const speed = dist / timeDiff;
				if (speed > maxSpeedMps) maxSpeedMps = speed;
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

	// Elevation
	const ascent = track.elevation?.positive ? `${formatNumber(track.elevation.positive, 0)} m` : '';
	const descentVal = track.elevation?.negative || 0;
	const descent = descentVal > 0 ? `${formatNumber(descentVal, 0)} m` : '';

	// Additional elevation metrics
	const maxElevation = track.elevation?.maximum
		? `${formatNumber(track.elevation.maximum, 0)} m`
		: undefined;
	const minElevation = track.elevation?.minimum
		? `${formatNumber(track.elevation.minimum, 0)} m`
		: undefined;
	const avgElevation = track.elevation?.average
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
}

export async function parseActivityFile(
	xmlString: string,
	fileExtension: string
): Promise<StatValues> {
	const ext = fileExtension.toLowerCase().replace(/^\./, '');
	if (ext === 'gpx') {
		return parseGpxToOverlayValues(xmlString);
	} else {
		return parseTcxToOverlayValues(xmlString);
	}
}

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);
	const parts: string[] = [];
	if (hours > 0) parts.push(String(hours).padStart(1, '0'));
	parts.push(String(minutes).padStart(2, '0'));
	parts.push(String(seconds).padStart(2, '0'));
	return parts.join(':');
}

export function metersToKm(meters: number): number {
	return meters / 1000;
}

export function averageSpeedMetersPerSecond(
	distanceMeters: number,
	durationSeconds: number
): number {
	if (durationSeconds <= 0) return 0;
	return distanceMeters / durationSeconds;
}

export function speedToKmh(metersPerSecond: number): number {
	return metersPerSecond * 3.6;
}

export function paceMinPerKm(metersPerSecond: number): number {
	if (metersPerSecond <= 0) return 0;
	const secPerKm = 1000 / metersPerSecond;
	return secPerKm / 60;
}

export function formatPace(minPerKm: number): string {
	if (minPerKm <= 0) return '0:00 /km';
	const minutes = Math.floor(minPerKm);
	const seconds = Math.round((minPerKm - minutes) * 60);
	return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatNumber(n: number, fractionDigits: number = 1): string {
	return n.toFixed(fractionDigits);
}

// Calculate distance between two GPS coordinates using Haversine formula (returns meters)
function calculatePointDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371000; // Earth's radius in meters
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}
