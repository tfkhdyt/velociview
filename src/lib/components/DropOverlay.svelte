<script lang="ts">
	let { visible = false }: { visible: boolean } = $props();
</script>

{#if visible}
	<div class="pointer-events-none fixed inset-0 z-50">
		<div
			class="absolute inset-0"
			style="background-color: color-mix(in srgb, var(--color-accent) 7%, transparent);"
		></div>
		<div class="absolute inset-0 flex items-center justify-center">
			<div
				class="pointer-events-none rounded-xl border border-dashed border-accent bg-white/40 px-6 py-3 text-sm font-medium text-accent shadow-lg backdrop-blur-md [[data-theme=dark]_&]:bg-zinc-900/40"
			>
				Drop image or .tcx anywhere to load
			</div>
		</div>
	</div>
{/if}
