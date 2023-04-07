<script lang="ts">
	export let onChange: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void
	export let value: bigint
</script>

<input on:change={onChange} on:blur={onChange} {value} />

<style>
	input:focus {
		background-color: #333;
		color: #000;
		outline: none;
	}

	input {
		border: 2px solid white;
		font-size: 1rem;
		color: #222;
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
		background-color: #000;
		padding: 6px 12px;
	}
</style>
