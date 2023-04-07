<script lang="ts">
	export let title: string
	export let onClick: () => void
	export let isActive: boolean = false
</script>

<button on:click={onClick} class={isActive ? 'active' : ''}>{title}</button>

<style>
	button:hover,
	.active {
		background-color: #333;
		color: #000;
	}

	button {
		cursor: pointer;
		border: 2px solid white;
		font-size: 1rem;
		color: #222;
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
		background-color: #000;
		padding: 6px 12px;
	}
</style>
