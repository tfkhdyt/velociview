// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ShareData {
		title?: string;
		text?: string;
		url?: string;
		files?: ReadonlyArray<File>;
	}

	interface Navigator {
		canShare?: (data?: ShareData) => boolean;
		share?: (data: ShareData) => Promise<void>;
	}
}

export {};
