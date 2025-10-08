export type UnitSystem = 'metric' | 'imperial';

export function getStoredUnits(): UnitSystem {
	if (typeof window === 'undefined') return 'metric';
	const u = localStorage.getItem('units');
	return u === 'imperial' ? 'imperial' : 'metric';
}

export function setStoredUnits(units: UnitSystem): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('units', units);
}
