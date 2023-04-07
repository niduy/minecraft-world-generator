import * as Comlink from 'comlink'
import { getBiomesImageDimentions } from './colors'
import { World } from './minecraft'
import type { Config, Range, StructurePosition } from './types'

type MapConfig = {
	sx: number
	sz: number
	mapScale: number
}

const CONFIGS: Record<Config, MapConfig> = {
	small: {
		sx: 16,
		sz: 16,
		mapScale: 4
	},
	medium: {
		sx: 32,
		sz: 32,
		mapScale: 2
	},
	large: {
		sx: 64,
		sz: 64,
		mapScale: 1
	}
}

const getRange = (config: Config) => {
	const { sx, sz, mapScale } = CONFIGS[config]
	const range: Range = {
		scale: 4,
		mapScale,
		sx,
		sy: 1,
		sz,
		x: 0,
		y: 255,
		z: 0
	}

	return range
}

export class MinecraftWrapper {
	// seed with a mansion next to the spawn
	private world = new World(12370816993565n)
	private range = getRange('large')

	private setWorld(seed: bigint) {
		if (this.world.seed !== seed) this.world = new World(seed)
	}

	setRange(config: Config) {
		this.range = getRange(config)
		return this.range
	}

	getRange() {
		return this.range
	}

	getBiomes(seed: bigint) {
		this.setWorld(seed)
		return this.world.getBiomes(this.range)
	}

	getStructures(seed: bigint) {
		this.setWorld(seed)
		const { sx, sz, scale } = this.range

		const configs = this.world.getStructureConfigList()
		const structures: StructurePosition[] = []

		for (const config of configs) {
			structures.push(...this.world.getStructures(config, sx, sz, scale))
		}

		return structures
	}

	getBiomesImageDimentions(sx: number, sz: number, scale: number, mapScale: number) {
		return getBiomesImageDimentions(sx, sz, scale, mapScale)
	}
}

Comlink.expose(new MinecraftWrapper())
