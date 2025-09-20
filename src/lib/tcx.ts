import { SportsLib } from '@sports-alliance/sports-lib';
import type { EventInterface } from '@sports-alliance/sports-lib/lib/events/event.interface';
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

export async function parseTcxToOverlayValues(xmlString: string): Promise<StatValues> {
	const parser = new DOMParser();
	const xml = parser.parseFromString(xmlString, 'application/xml');
	const event = await SportsLib.importFromTCX(xml);

	const distance = `${event.getDistance().getDisplayValue()} km`;

	const movingTimeRaw = String(event.getDuration().getDisplayValue());
	const movingTime = movingTimeRaw
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

	const avgSpeed = `${avgSpeedStat ?? ''} km/h`;
	const maxSpeed = `${maxSpeedStat ?? ''} km/h`;
	const avgPace = avgPaceStat != null ? `${avgPaceStat} m/km` : undefined;
	const maxPace = maxPaceStat != null ? `${maxPaceStat} m/km` : undefined;
	const ascent = `${ascentStat ?? ''} m`;
	const descent = `-${descentStat ?? ''} m`;

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
