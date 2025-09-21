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
	const root: HTMLElement = document.documentElement;

	// Temporarily disable transitions/animations while flipping theme
	root.classList.add('theme-transition-disabled');

	if (resolvedTheme === 'dark') {
		root.setAttribute('data-theme', 'dark');
		(root.style as CSSStyleDeclaration).colorScheme = 'dark';
	} else {
		root.setAttribute('data-theme', 'light');
		(root.style as CSSStyleDeclaration).colorScheme = 'light';
	}

	// Re-enable transitions on next frame after styles have applied
	requestAnimationFrame(() => {
		root.classList.remove('theme-transition-disabled');
	});
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
