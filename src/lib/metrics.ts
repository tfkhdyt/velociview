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
