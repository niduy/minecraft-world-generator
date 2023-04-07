import type { BIOME, STRUCTURE } from './const'

export type Config = 'small' | 'medium' | 'large'

export type Range = {
	scale: number
	mapScale: number
	x: number
	z: number
	y: number
	sx: number
	sz: number
	sy: number
}

export type Structure = (typeof STRUCTURE)[keyof typeof STRUCTURE]

export type Biome = keyof typeof BIOME

export type BiomeValue = (typeof BIOME)[Biome]

export type StructureVariant = {
	abandoned: boolean
	giant: boolean
	underground: boolean
	airpocket: boolean
	start: number
	biome: number
	rotation: number
	mirror: boolean
	x: number
	y: number
	z: number
	sx: number
	sy: number
	sz: number
}

export type StructureConfig = {
	salt: bigint
	regionSize: bigint
	chunkRange: bigint
	type: Structure
	isTriangular?: boolean
	isChunk?: boolean
}

export type Position = {
	x: number
	z: number
}

export type StructurePosition = {
	x: number
	z: number
	type: Structure
}

export type Offsets = [number, number, number, number, number, number]
