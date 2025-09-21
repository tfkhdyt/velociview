<script lang="ts">
	let {
		tcxLoading,
		onImageChange,
		onTcxChange,
		imageInputEl = $bindable(),
		tcxInputEl = $bindable()
	}: {
		tcxLoading: boolean;
		onImageChange: (files: FileList | null) => void;
		onTcxChange: (files: FileList | null) => void;
		imageInputEl?: HTMLInputElement | null;
		tcxInputEl?: HTMLInputElement | null;
	} = $props();
</script>

<div class="grid gap-4 md:grid-cols-2">
	<div class="space-y-2">
		<label class="form-label" for="image-input">Image</label>
		<input
			id="image-input"
			type="file"
			accept="image/*"
			onchange={(e) => onImageChange((e.target as HTMLInputElement).files)}
			class="form-control"
			bind:this={imageInputEl}
		/>
	</div>
	<div class="space-y-2">
		<label class="form-label inline-flex items-center gap-1" for="tcx-input">
			TCX
			<span class="group relative ml-1">
				<button
					type="button"
					class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted hover:bg-foreground/10 focus:outline-none"
					aria-describedby="tcx-tooltip"
					aria-label="What is a TCX?">?</button
				>
				<span
					id="tcx-tooltip"
					role="tooltip"
					class="pointer-events-none absolute top-full left-0 z-10 mt-1 w-72 rounded-md border border-border bg-white/95 p-2 text-xs text-foreground opacity-0 shadow-lg duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [[data-theme=dark]_&]:bg-zinc-900/95"
				>
					<strong>What is a TCX?</strong> A Training Center XML file with GPS and workout stats. Export
					it from apps like Strava, Garmin Connect, Wahoo, or Polar (look for “Export TCX” on the activity
					page).
				</span>
			</span>
		</label>
		<div class="relative">
			<input
				id="tcx-input"
				type="file"
				accept=".tcx"
				onchange={(e) => onTcxChange((e.target as HTMLInputElement).files)}
				disabled={tcxLoading}
				class="form-control pr-10 disabled:cursor-not-allowed disabled:opacity-50"
				bind:this={tcxInputEl}
			/>
			{#if tcxLoading}
				<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
					<svg
						class="h-5 w-5 animate-spin text-accent"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
						></path>
					</svg>
				</div>
			{/if}
		</div>
	</div>
</div>
