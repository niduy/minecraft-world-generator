<script lang="ts">
	import { onMount } from 'svelte'
	import { writable } from 'svelte/store'
	import * as Comlink from 'comlink'
	import Map from '$components/map.svelte'
	import Loader from '$components/loader.svelte'
	import Title from '$components/title.svelte'
	import Button from '$components/button.svelte'
	import Input from '$components/input.svelte'
	import MinecraftWorker from '$lib/minecraft/worker?worker'
	import type { Config as RangeConfig } from '$lib/minecraft/types'
	import { STRUCTURE, STRUCTURE_TO_TEXT } from '$lib/minecraft/const'

	const rangeConfig = writable<RangeConfig>('small')
	const seed = writable(12370816993565n)

	const buttons: { config: RangeConfig; title: string; note: string }[] = [
		{ config: 'small', title: 'Small', note: '256x256' },
		{ config: 'medium', title: 'Medium', note: '512x512' },
		{ config: 'large', title: 'Large', note: '1024x1024' }
	]

	const structureList = Object.values(STRUCTURE).map((key) => STRUCTURE_TO_TEXT[key])

	const renderProps = async (config: RangeConfig, seed: bigint) => {
		const world = Comlink.wrap<import('$lib/minecraft/worker').MinecraftWrapper>(
			new MinecraftWorker()
		)

		const range = await world.setRange(config)
		const biomes = await world.getBiomes(seed)
		const structures = await world.getStructures(seed)

		return {
			structures,
			range,
			biomes
		}
	}

	const handleSeedChange = (
		e: Event & {
			currentTarget: EventTarget & HTMLInputElement
		}
	) => {
		let { value } = e.currentTarget
		if (value.includes('.')) value = value.slice(0, value.indexOf('.'))

		seed.set(BigInt(value))
	}

	$: props = renderProps($rangeConfig, $seed)

	onMount(() => {
		if (process.env.NODE_ENV === 'development' && navigator.userAgent.indexOf('Firefox') !== -1) {
			alert('Development in Firefox is not supported. Close the alert and see the error')
			throw new Error(
				"Web Worker constructors don't support ECMAScript modules in Firefox, which makes it impossible to during the development. See https://caniuse.com/mdn-api_worker_worker_ecmascript_modules"
			)
		}
	})
</script>

<svelte:head>
	<title>Minecraft World Generation</title>
	<meta name="description" content="Minecraft World Generation 1.19.3" />
</svelte:head>

<Title text="Minecraft World Generation" />

<p class="note">
	<a
		href="http://github.com/niduy/minecraft-world-generation"
		target="_blank"
		rel="noopener noreferrer">Source Code</a
	>
</p>

<div class="container">
	<Input onChange={handleSeedChange} value={$seed} />
	<div class="button-container">
		{#each buttons as button}
			<Button
				title={button.title}
				isActive={button.config === $rangeConfig}
				onClick={() => rangeConfig.set(button.config)}
			/>
		{/each}
	</div>
</div>

<div class="container">
	{#await props}
		<div class="loader-wrapper">
			<div class="loader">
				<Loader />
			</div>
			{#if $rangeConfig === 'large'}
				<p class="loader-text">Go get some snacks! This is gonna take a while</p>
			{/if}
		</div>
	{:then awaitedProps}
		<Map {...awaitedProps} />
	{/await}
</div>

<p class="note">
	Looking for a faster biome and structure generator? Try <a
		href="https://chunkbase.com"
		target="_blank"
		rel="noopener noreferrer">chunkbase.com</a
	> instead
</p>

<h2 class="structure-item-title">Available Structures:</h2>
<ul class="structure-list">
	{#each structureList as structure}
		<li class="structure-item">{structure}</li>
	{/each}
</ul>

<style>
	.note {
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
		color: #222;
		font-size: 0.7rem;
		width: 100%;
		text-align: center;
	}

	.structure-list {
		display: flex;
		flex-direction: column;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 3px;
		width: 100%;
		list-style-type: space-counter;
		padding-bottom: 10px;
	}

	.structure-item-title {
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
		color: #222;
		width: 100%;
		text-align: center;
		margin-top: 20px;
	}

	.structure-item {
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
		color: #222;
	}

	.container {
		display: grid;
		place-items: center;
		width: 100%;
		margin: 10px 0;
	}

	.loader {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.loader-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin-top: 80px;
		text-align: center;
		color: #222;
		text-shadow: 1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff, 0.5px 0.5px #fff,
			-0.5px -0.5px #fff, 0.5px -0.5px #fff, -0.5px 0.5px #fff;
	}

	.loader-wrapper {
		position: relative;
		width: 518px;
		height: 518px;
		background: #555;
		border: 3px solid white;
	}

	.button-container {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 10px;
		margin-bottom: 20px 0;
		padding: 10px 0;
	}
</style>
