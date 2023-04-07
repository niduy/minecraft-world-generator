<script lang="ts">
	export let text: string
</script>

<h1 class="bordered-text">{text}</h1>

<style>
	h1 {
		text-shadow: 2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff, 1px 1px #fff, -1px -1px #fff,
			1px -1px #fff, -1px 1px #fff;
		color: #222;
		width: 100%;
		margin: 20px 0;
		text-align: center;
	}
</style>
