<script lang="ts">
	import { onMount } from 'svelte'
	import Icons from '$assets/minecraft/icons.png'
	import { ICON_MAP, STRUCTURE_TO_TEXT } from '$lib/minecraft/const'
	import { createImageFromBiomes } from '$lib/minecraft/colors'
	import type { StructurePosition, Range, Position, BiomeValue } from '$lib/minecraft/types'

	export let range: Range
	export let biomes: BiomeValue[]
	export let structures: StructurePosition[]

	// TODO: make the values dynamic
	const CANVAS_WIDTH = 512
	const CANVAS_HEIGHT = 512

	const loadImageAsync = (imgUrl: string): Promise<HTMLImageElement> => {
		return new Promise((resolve, reject) => {
			const img = new Image()
			img.src = imgUrl
			img.onload = () => resolve(img)
			img.onerror = (error) => reject(error)
		})
	}

	const getStructureCoordsInCanvas = (
		{ x, z }: StructurePosition,
		canvas: HTMLCanvasElement,
		{ sx, sz, scale }: Range
	) => {
		const { width, height } = canvas.getBoundingClientRect()

		const tempX = Math.abs(x) / (sx * scale * 4)
		const tempZ = Math.abs(z) / (sz * scale * 4)

		const percentX = Math.sign(x) === -1 ? 0.5 - tempX : 0.5 + tempX
		const percentZ = Math.sign(z) === -1 ? 0.5 - tempZ : 0.5 + tempZ

		const innerX = percentX * width
		const innerZ = percentZ * height

		return [innerX, innerZ]
	}

	const isNearby = ({ x, z }: Position, { x: px, z: pz }: Position, maxDistance: number) => {
		return (
			x >= px - maxDistance &&
			x <= px + maxDistance &&
			z >= pz - maxDistance &&
			z <= pz + maxDistance
		)
	}

	onMount(() => {
		const { sx, sz, scale, mapScale } = range
		const canvas = document.getElementById('map') as HTMLCanvasElement
		const tooltip = document.getElementById('tooltip') as HTMLDivElement
		const body = document.querySelector('body') as HTMLBodyElement
		const mapData = createImageFromBiomes(biomes, sx, sz, scale, mapScale)

		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Canvas is not ready')

		ctx.putImageData(mapData, 0, 0, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

		loadImageAsync(Icons).then((icons) => {
			for (let i = 0; i < structures.length; i++) {
				const structure = structures[i]
				const { x, y } = ICON_MAP[structure.type]
				const [innerX, innerZ] = getStructureCoordsInCanvas(structure, canvas, range)
				const posX = innerX - 8
				const posY = innerZ - 8

				ctx.fillStyle = 'black'
				ctx.strokeStyle = 'white'

				ctx.rect(posX, posY, 16, 16)
				ctx.fillRect(posX, posY, 16, 16)
				ctx.drawImage(icons, x, y, 16, 16, posX, posY, 16, 16)
				ctx.stroke()
			}
		})

		const handleMapEnter = () => (tooltip.style.display = 'block')
		const handleMapLeave = () => (tooltip.style.display = 'none')

		let mouseThrottle = Date.now()
		const handleMouseMove = ({ clientX, clientY }: MouseEvent) => {
			const now = Date.now()
			if (now - mouseThrottle < 10) return
			mouseThrottle = now

			const canvasRect = canvas.getBoundingClientRect()

			if (
				clientX >= canvasRect.left &&
				clientX <= canvasRect.right &&
				clientY >= canvasRect.top &&
				clientY <= canvasRect.bottom
			) {
				const tRect = tooltip.getBoundingClientRect()
				const shouldShiftLeft = clientX + tRect.width > window.innerWidth

				tooltip.style.left = `${shouldShiftLeft ? clientX - tRect.width : clientX}px`
				tooltip.style.top = `${clientY}px`

				const mWidth = sx * scale * 4
				const mHeight = sz * scale * 4

				const innerX = clientX - canvasRect.left
				const innerY = clientY - Math.round(canvasRect.top)

				const percentX = innerX / canvasRect.width
				const percentY = innerY / canvasRect.height

				const tempX = percentX - 0.5
				const tempY = percentY - 0.5

				const minecraftX = Math.floor(tempX * mWidth)
				const minecraftY = Math.floor(tempY * mHeight)

				for (let structure of structures) {
					const [innerStructureX, innerStructureZ] = getStructureCoordsInCanvas(
						structure,
						canvas,
						range
					)

					if (isNearby({ x: innerX, z: innerY }, { x: innerStructureX, z: innerStructureZ }, 12)) {
						tooltip.innerText = STRUCTURE_TO_TEXT[structure.type]
						return
					}
				}

				tooltip.innerText = `${minecraftX}, ${minecraftY}`
			}
		}

		canvas.addEventListener('mouseenter', handleMapEnter)
		canvas.addEventListener('mouseout', handleMapLeave)
		body.addEventListener('mousemove', handleMouseMove)

		return () => {
			canvas.removeEventListener('mouseenter', handleMapEnter)
			canvas.removeEventListener('mouseout', handleMapLeave)
			body.removeEventListener('mousemove', handleMouseMove)
		}
	})
</script>

<div class="map-container">
	<div id="tooltip" />
	<canvas id="map" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
</div>

<style>
	.map-container {
		position: relative;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	#map {
		border: 3px solid white;
	}

	#tooltip {
		width: fit-content;
		position: fixed;
		display: none;
		background: white;
		border: 1px solid #ccc;
		padding: 5px;
		pointer-events: none;
		transform: translateY(-100%);
	}
</style>
