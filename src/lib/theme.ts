export type Theme = 'light' | 'dark' | 'system';

export function getSystemTheme(): 'light' | 'dark' {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): Theme {
	if (typeof window === 'undefined') return 'system';

	const stored = localStorage.getItem('theme') as Theme | null;
	if (stored && ['light', 'dark', 'system'].includes(stored)) {
		return stored;
	}

	return 'system';
}

export function setStoredTheme(theme: Theme): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('theme', theme);
}

export function getResolvedTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') {
		return getSystemTheme();
	}
	return theme;
}

export function applyTheme(theme: Theme): void {
	if (typeof window === 'undefined') return;

	const resolvedTheme = getResolvedTheme(theme);
	const root = document.documentElement;

	if (resolvedTheme === 'dark') {
		root.setAttribute('data-theme', 'dark');
	} else {
		root.setAttribute('data-theme', 'light');
	}
}

export function initializeTheme(): Theme {
	if (typeof window === 'undefined') return 'system';

	const storedTheme = getStoredTheme();
	applyTheme(storedTheme);

	// Listen for system theme changes
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handleChange = () => {
		const currentTheme = getStoredTheme();
		if (currentTheme === 'system') {
			applyTheme('system');
		}
	};

	mediaQuery.addEventListener('change', handleChange);

	return storedTheme;
}
