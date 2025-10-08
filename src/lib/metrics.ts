export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);
	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (hours > 0 || minutes > 0) parts.push(`${minutes}m`);
	parts.push(`${seconds}s`);
	return parts.join(' ');
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
export function calculatePointDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
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

// =============== Unit-aware helpers ===============
import type { UnitSystem } from './units';

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;
const MPS_TO_MPH = 2.2369362920544;
const METERS_TO_FEET = 3.28084;

export function formatDistance(meters: number, units: UnitSystem): string {
	const value = units === 'imperial' ? meters / METERS_PER_MILE : meters / METERS_PER_KM;
	return `${formatNumber(value, 2)} ${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatSpeed(metersPerSecond: number, units: UnitSystem): string {
	if (units === 'imperial') {
		const mph = metersPerSecond * MPS_TO_MPH;
		return `${formatNumber(mph, 1)} mph`;
	}
	const kmh = speedToKmh(metersPerSecond);
	return `${formatNumber(kmh, 1)} km/h`;
}

export function paceMinPerMile(metersPerSecond: number): number {
	if (metersPerSecond <= 0) return 0;
	const secPerMile = METERS_PER_MILE / metersPerSecond;
	return secPerMile / 60;
}

export function formatPaceImperial(minPerMile: number): string {
	if (minPerMile <= 0) return '0:00 /mi';
	const minutes = Math.floor(minPerMile);
	const seconds = Math.round((minPerMile - minutes) * 60);
	return `${minutes}:${String(seconds).padStart(2, '0')} /mi`;
}

export function formatElevation(meters: number, units: UnitSystem): string {
	if (units === 'imperial') {
		const feet = meters * METERS_TO_FEET;
		return `${formatNumber(feet, 0)} ft`;
	}
	return `${formatNumber(meters, 0)} m`;
}
