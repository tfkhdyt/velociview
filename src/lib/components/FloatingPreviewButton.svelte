<script lang="ts">
	let {
		visible,
		floatingCanvasEl = $bindable(),
		onClick
	}: {
		visible: boolean;
		floatingCanvasEl?: HTMLCanvasElement | null;
		onClick: () => void;
	} = $props();
</script>

{#if visible}
	<button
		class="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-border bg-white/80 px-2 py-2 shadow-lg ring-0 backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden [[data-theme=dark]_&]:bg-zinc-900/70"
		type="button"
		onclick={onClick}
		aria-label="Scroll to main preview"
		title="Scroll to main preview"
	>
		<canvas
			bind:this={floatingCanvasEl}
			class="block h-auto w-[42vw] max-w-[11rem] min-w-[8rem] rounded-lg border border-border bg-transparent"
		></canvas>
		<span class="sr-only">Open preview</span>
	</button>
{/if}
