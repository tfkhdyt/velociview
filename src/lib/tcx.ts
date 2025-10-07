import { SportsLib } from '@sports-alliance/sports-lib';
import type { EventInterface } from '@sports-alliance/sports-lib/lib/events/event.interface';
import { formatDuration, formatPace } from './metrics';
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
