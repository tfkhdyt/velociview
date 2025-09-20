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
		<label class="form-label" for="tcx-input">TCX</label>
		<div class="relative">
			<input
				id="tcx-input"
				type="file"
				accept=".tcx,application/vnd.garmin.tcx+xml,application/xml,text/xml"
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
