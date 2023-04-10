import {
	add64,
	rightShift32,
	leftShift64,
	lerp,
	multiply64,
	rightShift64,
	rotl64,
	xor64,
	intToUint64,
	uint64ToInt32,
	uint64ToInt64,
	MAX_UINT64,
	MAX_UINT32,
	add32,
	xor32,
	bswap32,
	rotr32
} from './math'
import { BIOME, BIOME_PARAMS, BIOME_TREE, BIOME_VALUES, STRUCTURE } from './const'

import type {
	Range,
	Structure,
	BiomeValue,
	StructureVariant,
	StructureConfig,
	StructurePosition,
	Position,
	Offsets
} from './types'

const MONUMENT_BIOMES_BINARY = 2234207644421249n

const Climate = {
	Temperature: 0,
	Humidity: 1,
	Continentalness: 2,
	Erosion: 3,
	PeaksAndValleys: 4,
	Weirdness: 5
} as const

const Land = {
	Continentalness: 0,
	Erosion: 1,
	PeaksAndValleys: 2
} as const

class Spline {
	length = 0
	type: (typeof Land)[keyof typeof Land] = Land.Continentalness
	loc = new Float32Array(12)
	der = new Float32Array(12)
	value: FixedSpline[] = new Array(12)
}

class FixedSpline {
	length = 1
	value = 0

	constructor(val?: number) {
		if (val) this.value = val
	}
}

class SplineStack {
	length = 0
	stack = new Array(42).fill(null).map(() => new Spline())
	fixedStack = new Array()
}

class PerlinNoise {
	a = 0
	b = 0
	c = 0
	d = new Array(512)
	amplitude = 0
	lacunarity = 0
}

class OctaveNoise {
	octaveCount = 0
	octaves: PerlinNoise[] = []
}

class DoublePerlinNoise {
	amplitude = 0
	octaveNoise1 = new OctaveNoise()
	octaveNoise2 = new OctaveNoise()
}

class Xoroshiro {
	low = 0n
	high = 0n
	constructor(low: bigint, high: bigint) {
		this.low = low
		this.high = high
	}
}

class BiomeNoise {
	splineStack = new SplineStack()
	spline = new Spline()
	length = 0
	stack: unknown[] = []
	climateType = -1
	octaves: PerlinNoise[] = new Array(46).fill(null).map(() => new PerlinNoise())
	climate: DoublePerlinNoise[] = new Array(6).fill(null).map(() => new DoublePerlinNoise())
}

export class World {
	sha: bigint = 0n
	biomeNoise: BiomeNoise = new BiomeNoise()
	structures: StructureVariant[] = []

	constructor(public seed: bigint) {
		this.initBiomeNoise()
		this.setBiomeSeed(seed)
		this.sha = this.getVoronoiSHA(seed)
	}

	getVoronoiSHA(seed: bigint) {
		const K = [
			0x428a2f98n,
			0x71374491n,
			0xb5c0fbcfn,
			0xe9b5dba5n,
			0x3956c25bn,
			0x59f111f1n,
			0x923f82a4n,
			0xab1c5ed5n,
			0xd807aa98n,
			0x12835b01n,
			0x243185ben,
			0x550c7dc3n,
			0x72be5d74n,
			0x80deb1fen,
			0x9bdc06a7n,
			0xc19bf174n,
			0xe49b69c1n,
			0xefbe4786n,
			0x0fc19dc6n,
			0x240ca1ccn,
			0x2de92c6fn,
			0x4a7484aan,
			0x5cb0a9dcn,
			0x76f988dan,
			0x983e5152n,
			0xa831c66dn,
			0xb00327c8n,
			0xbf597fc7n,
			0xc6e00bf3n,
			0xd5a79147n,
			0x06ca6351n,
			0x14292967n,
			0x27b70a85n,
			0x2e1b2138n,
			0x4d2c6dfcn,
			0x53380d13n,
			0x650a7354n,
			0x766a0abbn,
			0x81c2c92en,
			0x92722c85n,
			0xa2bfe8a1n,
			0xa81a664bn,
			0xc24b8b70n,
			0xc76c51a3n,
			0xd192e819n,
			0xd6990624n,
			0xf40e3585n,
			0x106aa070n,
			0x19a4c116n,
			0x1e376c08n,
			0x2748774cn,
			0x34b0bcb5n,
			0x391c0cb3n,
			0x4ed8aa4an,
			0x5b9cca4fn,
			0x682e6ff3n,
			0x748f82een,
			0x78a5636fn,
			0x84c87814n,
			0x8cc70208n,
			0x90befffan,
			0xa4506cebn,
			0xbef9a3f7n,
			0xc67178f2n
		]
		const B = [
			0x6a09e667n,
			0xbb67ae85n,
			0x3c6ef372n,
			0xa54ff53an,
			0x510e527fn,
			0x9b05688cn,
			0x1f83d9abn,
			0x5be0cd19n
		]

		const m: bigint[] = new Array(64).fill(0n)
		m[0] = bswap32(seed & BigInt(MAX_UINT32))
		m[1] = bswap32(((seed & MAX_UINT64) >> 32n) & BigInt(MAX_UINT32))
		m[2] = 0x80000000n
		m[15] = 0x00000040n

		for (let i = 16; i < 64; ++i) {
			m[i] = add32(m[i - 7], m[i - 16])
			let x = m[i - 15]
			m[i] = add32(
				m[i],
				xor32(xor32(rotr32(x, 7n), rotr32(x, 18n)), BigInt(Number(x & MAX_UINT32) >>> 3))
			)
			x = m[i - 2]
			m[i] = add32(
				m[i],
				xor32(rotr32(x, 17n), xor32(rotr32(x, 19n), BigInt(Number(x & MAX_UINT32) >>> 10)))
			)
		}

		let a0 = B[0]
		let a1 = B[1]
		let a2 = B[2]
		let a3 = B[3]
		let a4 = B[4]
		let a5 = B[5]
		let a6 = B[6]
		let a7 = B[7]

		for (let i = 0; i < 64; i++) {
			let x = add32(add32(a7, K[i]), m[i])
			x = add32(x, xor32(xor32(rotr32(a4, 6n), rotr32(a4, 11n)), rotr32(a4, 25n)))
			x = add32(x, xor32(a4 & a5, ~a4 & a6))

			let y = xor32(xor32(rotr32(a0, 2n), rotr32(a0, 13n)), rotr32(a0, 22n))
			y += xor32(xor32(a0 & a1, a0 & a2), a1 & a2)

			a7 = a6
			a6 = a5
			a5 = a4
			a4 = add32(a3, x)
			a3 = a2
			a2 = a1
			a1 = a0
			a0 = add32(x, y)
		}

		a0 = add32(a0, B[0])
		a1 = add32(a1, B[1])

		return BigInt(bswap32(a0)) | leftShift64(BigInt(bswap32(a1)), 32n)
	}

	xSetSeed(seed: bigint) {
		const XL = 0x9e3779b97f4a7c15n
		const XH = 0x6a09e667f3bcc909n
		const A = 0xbf58476d1ce4e5b9n
		const B = 0x94d049bb133111ebn

		let l = xor64(seed, XH)
		let h = add64(l, XL)

		l = multiply64(xor64(l, rightShift64(l, 30n)), A)
		h = multiply64(xor64(h, rightShift64(h, 30n)), A)
		l = multiply64(xor64(l, rightShift64(l, 27n)), B)
		h = multiply64(xor64(h, rightShift64(h, 27n)), B)
		l = xor64(l, rightShift64(l, 31n))
		h = xor64(h, rightShift64(h, 31n))

		return new Xoroshiro(l, h)
	}

	xNextLong(xr: Xoroshiro) {
		const l = xr.low
		const h = xr.high
		const n = add64(rotl64(l + h, 17n), l)
		const xor = xor64(h, l)

		xr.low = xor64(xor64(rotl64(l, 49n), xor), leftShift64(xor, 21n))
		xr.high = rotl64(xor, 28n)

		return n
	}

	setBiomeSeed(seed: bigint) {
		const bn = this.biomeNoise
		const pxr = this.xSetSeed(seed)

		const xLow = this.xNextLong(pxr)
		const xHigh = this.xNextLong(pxr)

		let count = 0
		// TODO: convert the loop into individual items
		// with all of the custom parans in a config
		for (let i = 0; i < 6; i++) {
			count += this.initClimageSeed(bn.climate[i], [...bn.octaves.slice(count)], xLow, xHigh, i, -1)
		}

		if (count > bn.octaves.length) {
			throw new Error('BiomeNoise is invalid, buffer is too small')
		}

		this.biomeNoise.climateType = -1
	}

	xNextInt(xr: Xoroshiro, n: number) {
		let r = multiply64(this.xNextLong(xr) & 0xffffffffn, BigInt(n))
		if ((r & 0xffffffffn) < n) {
			while ((r & 0xffffffffn) < (~n + 1) % n) {
				r = multiply64(this.xNextLong(xr) & 0xffffffffn, BigInt(n))
			}
		}
		return Number(rightShift64(r, 32n))
	}

	xNextDouble(xr: Xoroshiro) {
		return Number(rightShift64(this.xNextLong(xr), 11n)) * 1.1102230246251565e-16
	}

	getStructureConfigList(): StructureConfig[] {
		return Object.values(STRUCTURE).map((s) => this.getStructureConfig(s))
	}

	getStructureConfig(structure: Structure) {
		switch (structure) {
			case STRUCTURE.DesertPyramid:
				return {
					salt: 14357617n,
					regionSize: 32n,
					chunkRange: 24n,
					type: STRUCTURE.DesertPyramid
				}
			case STRUCTURE.JunglePyramid:
				return {
					salt: 14357619n,
					regionSize: 32n,
					chunkRange: 24n,
					type: STRUCTURE.JunglePyramid
				}
			case STRUCTURE.SwampHut:
				return {
					salt: 14357620n,
					regionSize: 32n,
					chunkRange: 24n,
					type: STRUCTURE.SwampHut
				}
			case STRUCTURE.Igloo:
				return { salt: 14357618n, regionSize: 32n, chunkRange: 24n, type: STRUCTURE.Igloo }
			case STRUCTURE.Village:
				return { salt: 10387312n, regionSize: 34n, chunkRange: 26n, type: STRUCTURE.Village }
			case STRUCTURE.OceanRuins:
				return {
					salt: 14357621n,
					regionSize: 20n,
					chunkRange: 12n,
					type: STRUCTURE.OceanRuins
				}
			case STRUCTURE.Shipwreck:
				return {
					salt: 165745295n,
					regionSize: 24n,
					chunkRange: 20n,
					type: STRUCTURE.Shipwreck
				}
			case STRUCTURE.RuinedPortal:
				return {
					salt: 34222645n,
					regionSize: 40n,
					chunkRange: 25n,
					type: STRUCTURE.RuinedPortal
				}
			case STRUCTURE.OceanMonument:
				return {
					salt: 10387313n,
					regionSize: 32n,
					chunkRange: 27n,
					type: STRUCTURE.OceanMonument,
					isTriangular: true
				}
			case STRUCTURE.Mansion:
				return {
					salt: 10387319n,
					regionSize: 80n,
					chunkRange: 60n,
					type: STRUCTURE.Mansion,
					isTriangular: true
				}
			case STRUCTURE.PillagerOutpost:
				return {
					salt: 165745296n,
					regionSize: 32n,
					chunkRange: 24n,
					type: STRUCTURE.PillagerOutpost
				}
			case STRUCTURE.AncientCity:
				return {
					salt: 20083232n,
					regionSize: 24n,
					chunkRange: 16n,
					type: STRUCTURE.AncientCity
				}
			default:
				throw new Error('Invalid struct type')
		}
	}

	getStructures(config: StructureConfig, sx: number, sz: number, scale: number) {
		this.setBiomeSeed(this.seed)
		const positions: StructurePosition[] = []

		const x0 = Math.floor(sx * scale * 2) * -1
		const x1 = Math.floor(sx * scale * 2)
		const z0 = Math.floor(sz * scale * 2) * -1
		const z1 = Math.floor(sz * scale * 2)

		const xi0 = x0 / Number(config.regionSize * 16n)
		const xj0 = z0 / Number(config.regionSize * 16n)
		const xi1 = (x1 - 1) / Number(config.regionSize * 16n)
		const xj1 = (z1 - 1) / Number(config.regionSize * 16n)

		const si0 = Math.floor(xi0)
		const sj0 = Math.floor(xj0)
		const si1 = Math.floor(xi1)
		const sj1 = Math.floor(xj1)

		for (let i = si0; i <= si1; i++) {
			for (let j = sj0; j <= sj1; j++) {
				const pos = this.getStructurePos(config, this.seed, i, j)
				if (!pos) continue

				const isWithinRegion = pos.x >= x0 && pos.x <= x1 && pos.z >= z0 && pos.z <= z1
				if (!isWithinRegion) continue

				const isViablePosition = this.isViableStructurePosition(config.type, pos.x, pos.z)
				if (!isViablePosition) continue

				const isViableTerrain = this.isViableStructureTerrain(config.type, pos.x, pos.z)
				if (!isViableTerrain) continue

				if (config.type === STRUCTURE.AncientCity || config.type === STRUCTURE.Village) {
					const x = (pos.x >> 2) + 2
					const z = (pos.z >> 2) + 2
					const isUndergroundStructure = config.type === STRUCTURE.AncientCity
					const biomeId = this.getBiomeAt(1, x, isUndergroundStructure ? -50 : 255, z)
					const variant = this.getVariant(config.type, this.seed, pos.x, pos.z, biomeId)
					if (!variant) continue
				}

				positions.push({ ...pos, type: config.type })
			}
		}

		return positions.filter((pos, i, self) => {
			const j = self.findIndex((p) => p.x === pos.x && p.z === pos.z && p.type === pos.type)
			return i === j
		})
	}

	getStructurePos(config: StructureConfig, seed: bigint, regX: number, regZ: number) {
		switch (config.type) {
			case STRUCTURE.DesertPyramid:
			case STRUCTURE.JunglePyramid:
			case STRUCTURE.SwampHut:
			case STRUCTURE.Igloo:
			case STRUCTURE.Village:
			case STRUCTURE.OceanRuins:
			case STRUCTURE.Shipwreck:
			case STRUCTURE.RuinedPortal:
			case STRUCTURE.AncientCity:
				return this.getFeaturePosition(config, seed, regX, regZ)

			case STRUCTURE.OceanMonument:
			case STRUCTURE.Mansion:
				// TODO: combine these two functions into one since there are doing the same thing
				return this.getLargeStructurePosition(config, seed, regX, regZ)

			case STRUCTURE.PillagerOutpost:
				const pos = this.getFeaturePosition(config, seed, regX, regZ)
				const xSeed = this.setAttemptSeed(seed, pos.x >> 4, pos.z >> 4)
				const k = this.nextInt(xSeed, 5) === 0
				return k ? pos : null

			default:
				throw new Error('Invalid structure type')
		}
	}

	nextInt(seed: bigint, n: number) {
		const m = n - 1
		let xSeed = seed

		if ((m & n) === 0) {
			const [newSeed, int] = this.next(xSeed, 31n)
			xSeed = newSeed
			const x = n * int
			return x >> 31
		}

		let bits
		let val

		do {
			const [newSeed, int] = this.next(xSeed, 31n)
			xSeed = newSeed
			bits = int
			val = bits % n
		} while (bits - val + m < 0)

		return val
	}

	nextFloat(seed: bigint) {
		return this.next(seed, 24n)[1] / (1 << 24)
	}

	setAttemptSeed(s: bigint, cx: number, cz: number) {
		let xSeed = xor64(s, xor64(intToUint64(cx) >> 4n, leftShift64(intToUint64(cz) >> 4n, 4n)))
		xSeed = this.setSeed(xSeed)
		xSeed = this.next(xSeed, 31n)[0]
		return xSeed
	}

	next(seed: bigint, bits: bigint): [bigint, number] {
		const xSeed = add64(multiply64(seed, 0x5deece66dn), 0xbn) & (leftShift64(1n, 48n) - 1n)
		const int = Number(rightShift64(xSeed, 48n - bits))
		return [xSeed, int]
	}

	setSeed(value: bigint) {
		return xor64(value, 0x5deece66dn) & (leftShift64(1n, 48n) - 1n)
	}

	getFeaturePosition(config: StructureConfig, seed: bigint, regX: number, regZ: number) {
		const pos = this.getFeatureChunkInRegion(config, seed, regX, regZ)

		pos.x = uint64ToInt32(
			leftShift64(
				add64(multiply64(BigInt(intToUint64(regX)), config.regionSize), BigInt(pos.x)),
				4n
			)
		)
		pos.z = uint64ToInt32(
			leftShift64(
				add64(multiply64(BigInt(intToUint64(regZ)), config.regionSize), BigInt(pos.z)),
				4n
			)
		)

		return pos
	}

	getFeatureChunkInRegion(config: StructureConfig, seed: bigint, regX: number, regZ: number) {
		let pos: Position = {
			x: 0,
			z: 0
		}

		const K = 0x5deece66dn
		const M = leftShift64(1n, 48n) - 1n
		const b = 0xbn

		let xSeed = add64(
			add64(
				add64(
					multiply64(intToUint64(regX), 341873128712n),
					multiply64(intToUint64(regZ), 132897987541n)
				),
				config.salt
			),
			seed
		)
		xSeed = xor64(xSeed, K)
		xSeed = add64(multiply64(xSeed, K), b) & M

		if (config.chunkRange !== 1n) {
			pos.x = Number(rightShift64(xSeed, 17n) % config.chunkRange)
			xSeed = add64(multiply64(xSeed, K), b) & M
			pos.z = Number(rightShift64(xSeed, 17n) % config.chunkRange)
		} else {
			pos.x = Number(rightShift64(multiply64(config.chunkRange, rightShift64(xSeed, 17n)), 31n))
			xSeed = add64(multiply64(xSeed, K), b) & M
			pos.x = Number(rightShift64(multiply64(config.chunkRange, rightShift64(xSeed, 17n)), 31n))
		}

		return pos
	}

	getLargeStructurePosition(config: StructureConfig, seed: bigint, regX: number, regZ: number) {
		let pos = this.getLargeStructureChunkInRegion(config, seed, regX, regZ)

		pos.x = uint64ToInt32(
			leftShift64(
				add64(multiply64(BigInt(intToUint64(regX)), config.regionSize), BigInt(pos.x)),
				4n
			)
		)
		pos.z = uint64ToInt32(
			leftShift64(
				add64(multiply64(BigInt(intToUint64(regZ)), config.regionSize), BigInt(pos.z)),
				4n
			)
		)

		return pos
	}

	getLargeStructureChunkInRegion(
		config: StructureConfig,
		seed: bigint,
		regX: number,
		regZ: number
	) {
		const pos: Position = {
			x: 0,
			z: 0
		}

		const K = 0x5deece66dn
		const M = leftShift64(1n, 48n) - 1n
		const b = 0xbn

		// TODO: combine all 3 occurances of this exact logic into one function
		let xSeed = add64(
			add64(
				add64(
					multiply64(BigInt(intToUint64(regX)), 341873128712n),
					multiply64(BigInt(intToUint64(regZ)), 132897987541n)
				),
				config.salt
			),
			seed
		)
		xSeed = xor64(xSeed, K)

		xSeed = add64(multiply64(xSeed, K), b) & M
		pos.x = Number(rightShift64(xSeed, 17n) % config.chunkRange)
		xSeed = add64(multiply64(xSeed, K), b) & M
		pos.x += Number(rightShift64(xSeed, 17n) % config.chunkRange)

		xSeed = add64(multiply64(xSeed, K), b) & M
		pos.z = Number(rightShift64(xSeed, 17n) % config.chunkRange)
		xSeed = add64(multiply64(xSeed, K), b) & M
		pos.z += Number(rightShift64(xSeed, 17n) % config.chunkRange)

		pos.x >>= 1
		pos.z >>= 1

		return pos
	}

	xPerlinInit(noise: PerlinNoise, xr: Xoroshiro) {
		noise.a = this.xNextDouble(xr) * 256
		noise.b = this.xNextDouble(xr) * 256
		noise.c = this.xNextDouble(xr) * 256

		noise.amplitude = 1.0
		noise.lacunarity = 1.0

		const idx = noise.d

		for (let i = 0; i < 256; i++) {
			idx[i] = i
		}

		for (let i = 0; i < 256; i++) {
			const j = this.xNextInt(xr, 256 - i) + i
			const n = idx[i]
			idx[i] = idx[j]
			idx[j] = n
			idx[i + 256] = idx[i]
		}
	}

	xOctaveInit(
		noise: OctaveNoise,
		xr: Xoroshiro,
		perlinNoises: PerlinNoise[],
		amplitudes: number[],
		omin: number,
		lelength: number,
		nmax: number
	) {
		const md5_octave_n = [
			[0xb198de63a8012672n, 0x7b84cad43ef7b5a8n],
			[0x0fd787bfbc403ec3n, 0x74a4a31ca21b48b8n],
			[0x36d326eed40efeb2n, 0x5be9ce18223c636an],
			[0x082fe255f8be6631n, 0x4e96119e22dedc81n],
			[0x0ef68ec68504005en, 0x48b6bf93a2789640n],
			[0xf11268128982754fn, 0x257a1d670430b0aan],
			[0xe51c98ce7d1de664n, 0x5f9478a733040c45n],
			[0x6d7b49e7e429850an, 0x2e3063c622a24777n],
			[0xbd90d5377ba1b762n, 0xc07317d419a7548dn],
			[0x53d39c6752dac858n, 0xbcd1c5a80ab65b3en],
			[0xb4a24d7a84e7677bn, 0x023ff9668e89b5c4n],
			[0xdffa22b534c5f608n, 0xb9b67517d3665ca9n],
			[0xd50708086cef4d7cn, 0x6e1651ecc7f43309n]
		]

		const lacuna_ini = [
			1,
			0.5,
			0.25,
			1 / 8,
			1 / 16,
			1 / 32,
			1 / 64,
			1 / 128,
			1 / 256,
			1 / 512,
			1 / 1024,
			1 / 2048,
			1 / 4096
		]

		const persist_ini = [
			0,
			1,
			2 / 3,
			4 / 7,
			8 / 15,
			16 / 31,
			32 / 63,
			64 / 127,
			128 / 255,
			256 / 511
		]

		let lacuna = lacuna_ini[-omin]
		let persist = persist_ini[lelength]
		const xLow = this.xNextLong(xr)
		const xHigh = this.xNextLong(xr)
		let n = 0

		for (let i = 0; i < lelength && n !== nmax; i++, lacuna *= 2, persist *= 0.5) {
			if (amplitudes[i] === 0) continue

			const pxr = new Xoroshiro(
				xor64(xLow, md5_octave_n[12 + omin + i][0]),
				xor64(xHigh, md5_octave_n[12 + omin + i][1])
			)
			this.xPerlinInit(perlinNoises[n], pxr)

			perlinNoises[n].amplitude = amplitudes[i] * persist
			perlinNoises[n].lacunarity = lacuna
			n++
		}

		while (perlinNoises.length < 46) perlinNoises.push(new PerlinNoise())

		noise.octaves = perlinNoises
		noise.octaveCount = n

		return n
	}

	xDoublePerlinInit(
		noise: DoublePerlinNoise,
		xr: Xoroshiro,
		perlinNoises: PerlinNoise[],
		amplitudes: number[],
		omin: number,
		length: number,
		nmax: number
	) {
		let i = 0
		let n = 0
		let na = -1
		let nb = -1

		if (nmax > 0) {
			na = rightShift32(nmax + 1, 1)
			nb = nmax - na
		}

		n += this.xOctaveInit(
			noise.octaveNoise1,
			xr,
			[...perlinNoises.slice(n)],
			amplitudes,
			omin,
			length,
			na
		)
		n += this.xOctaveInit(
			noise.octaveNoise2,
			xr,
			[...perlinNoises.slice(n)],
			amplitudes,
			omin,
			length,
			nb
		)

		for (i = length - 1; i >= 0 && amplitudes[i] === 0; i--) length--
		for (i = 0; amplitudes[i] == 0.0; i++) length--

		const amp_ini = [
			0,
			5 / 6,
			10 / 9,
			15 / 12,
			20 / 15,
			25 / 18,
			30 / 21,
			35 / 24,
			40 / 27,
			45 / 30
		]

		noise.amplitude = amp_ini[length]
		return n
	}

	initClimageSeed(
		doublePerlineNoise: DoublePerlinNoise,
		perlinNoise: PerlinNoise[],
		xLow: bigint,
		xHigh: bigint,
		tempType: number,
		nmax: number
	) {
		const pxr = new Xoroshiro(0n, 0n)

		switch (tempType) {
			case Climate.Temperature: {
				const amplitude = [1.5, 0, 1, 0, 0, 0]
				pxr.low = xor64(xLow, 0x5c7e6b29735f0d7fn)
				pxr.high = xor64(xHigh, 0xf7d86f1bbc734988n)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -10, 6, nmax)
			}

			case Climate.Humidity: {
				const amplitude = [1, 1, 0, 0, 0, 0]
				pxr.low = xor64(xLow, 0x81bb4d22e8dc168en)
				pxr.high = xor64(xHigh, 0xf1c8b4bea16303cdn)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -8, 6, nmax)
			}

			case Climate.Continentalness: {
				const amplitude = [1, 1, 2, 2, 2, 1, 1, 1, 1]
				pxr.low = xor64(xLow, 0x83886c9d0ae3a662n)
				pxr.high = xor64(xHigh, 0xafa638a61b42e8adn)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -9, 9, nmax)
			}

			case Climate.Erosion: {
				const amplitude = [1, 1, 0, 1, 1]
				pxr.low = xor64(xLow, 0xd02491e6058f6fd8n)
				pxr.high = xor64(xHigh, 0x4792512c94c17a80n)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -9, 5, nmax)
			}

			case Climate.PeaksAndValleys: {
				const amplitude = [1, 1, 1, 0]
				pxr.low = xor64(xLow, 0x080518cf6af25384n)
				pxr.high = xor64(xHigh, 0x3f3dfb40a54febd5n)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -3, 4, nmax)
			}

			case Climate.Weirdness: {
				const amplitude = [1, 2, 1, 0, 0, 0]
				pxr.low = xor64(xLow, 0xefc8ef4d36102b34n)
				pxr.high = xor64(xHigh, 0x1beeeb324a0f24ean)
				return this.xDoublePerlinInit(doublePerlineNoise, pxr, perlinNoise, amplitude, -7, 6, nmax)
			}

			default:
				throw new Error(`Invalid climate parameter, ${tempType}`)
		}
	}

	createFixedSpline(value: number) {
		const fixedSpline = new FixedSpline(value)

		this.biomeNoise.splineStack.fixedStack.push(fixedSpline)

		// TODO: refactor to not use type casting
		return fixedSpline as unknown as Spline
	}

	getOffsetValue(weirdness: number, continentalness: number) {
		const f0 = 1.0 - (1.0 - continentalness) * 0.5
		const f1 = 0.5 * (1.0 - continentalness)
		const f2 = (weirdness + 1.17) * 0.46082947
		const offset = f2 * f0 - f1

		if (weirdness < -0.7) return offset > -0.2222 ? offset : -0.2222

		return offset > 0 ? offset : 0
	}

	addSplineValue(spline: Spline, loc: number, val: Spline, der: number) {
		spline.loc[spline.length] = loc
		spline.value[spline.length] = val as unknown as FixedSpline
		spline.der[spline.length] = der
		spline.length++
	}

	createFlatOffsetSpline(offsets: Offsets) {
		const o = offsets
		const ss = this.biomeNoise.splineStack
		const sp = ss.stack[ss.length++]
		sp.type = Land.PeaksAndValleys

		let l = 0.5 * (o[1] - o[0])

		if (l < o[5]) {
			l = o[5]
		}

		const m = 5 * (o[2] - o[1])

		this.addSplineValue(sp, -1.0, this.createFixedSpline(o[0]), l)
		this.addSplineValue(sp, -0.4, this.createFixedSpline(o[1]), l < m ? l : m)
		this.addSplineValue(sp, 0.0, this.createFixedSpline(o[2]), m)
		this.addSplineValue(sp, 0.4, this.createFixedSpline(o[3]), 2 * (o[3] - o[2]))
		this.addSplineValue(sp, 1.0, this.createFixedSpline(o[4]), 0.7 * (o[4] - o[3]))

		return sp
	}

	createSpline38219(continentalness: number, depth: number) {
		const splineStack = this.biomeNoise.splineStack
		const spline = splineStack.stack[splineStack.length++]
		spline.type = Land.PeaksAndValleys

		const i = this.getOffsetValue(-1.0, continentalness)
		const k = this.getOffsetValue(1.0, continentalness)
		let l = 1.0 - (1.0 - continentalness) * 0.5
		let u = 0.5 * (1.0 - continentalness)
		l = u / (0.46082947 * l) - 1.17

		if (-0.65 < l && l < 1.0) {
			u = this.getOffsetValue(-0.65, continentalness)
			const p = this.getOffsetValue(-0.75, continentalness)
			const q = (p - i) * 4.0
			const r = this.getOffsetValue(l, continentalness)
			const s = (k - r) / (1.0 - l)

			this.addSplineValue(spline, -1.0, this.createFixedSpline(i), q)
			this.addSplineValue(spline, -0.75, this.createFixedSpline(p), 0)
			this.addSplineValue(spline, -0.65, this.createFixedSpline(u), 0)
			this.addSplineValue(spline, l - 0.01, this.createFixedSpline(r), 0)
			this.addSplineValue(spline, l, this.createFixedSpline(r), s)
			this.addSplineValue(spline, 1.0, this.createFixedSpline(k), s)

			return spline
		}

		u = (k - i) * 0.5
		if (depth) {
			this.addSplineValue(spline, -1.0, this.createFixedSpline(i > 0.2 ? i : 0.2), 0)
			this.addSplineValue(spline, 0.0, this.createFixedSpline(lerp(0.5, i, k)), u)
		} else {
			this.addSplineValue(spline, -1.0, this.createFixedSpline(i), u)
		}

		this.addSplineValue(spline, 1.0, this.createFixedSpline(k), u)

		return spline
	}

	createLandSpline(offsets: Offsets, depth: number) {
		const o = offsets

		const ss = this.biomeNoise.splineStack
		const sp1 = this.createSpline38219(lerp(o[3], 0.6, 1.5), depth)
		const sp2 = this.createSpline38219(lerp(o[3], 0.6, 1.0), depth)
		const sp3 = this.createSpline38219(o[3], depth)

		const ih = 0.5 * o[3]

		const sp4 = this.createFlatOffsetSpline([o[0] - 0.15, ih, ih, ih, o[3] * 0.6, 0.5])
		const sp5 = this.createFlatOffsetSpline([o[0], o[4] * o[3], o[1] * o[3], ih, o[3] * 0.6, 0.5])
		const sp6 = this.createFlatOffsetSpline([o[0], o[4], o[4], o[1], o[2], 0.5])
		const sp7 = this.createFlatOffsetSpline([o[0], o[4], o[4], o[1], o[2], 0.5])

		const sp8 = ss.stack[ss.length]
		ss.length++
		sp8.type = Land.PeaksAndValleys

		this.addSplineValue(sp8, -1.0, this.createFixedSpline(o[0]), 0.0)
		this.addSplineValue(sp8, -0.4, sp6, 0.0)
		this.addSplineValue(sp8, 0.0, this.createFixedSpline(o[2] + 0.07), 0.0)

		const sp9 = this.createFlatOffsetSpline([-0.02, o[5], o[5], o[1], o[2], 0.0])
		const sp = ss.stack[ss.length]

		ss.length++
		sp.type = Land.Erosion

		this.addSplineValue(sp, -0.85, sp1, 0.0)
		this.addSplineValue(sp, -0.7, sp2, 0.0)
		this.addSplineValue(sp, -0.4, sp3, 0.0)
		this.addSplineValue(sp, -0.35, sp4, 0.0)
		this.addSplineValue(sp, -0.1, sp5, 0.0)
		this.addSplineValue(sp, 0.2, sp6, 0.0)

		if (depth) {
			this.addSplineValue(sp, 0.4, sp7, 0.0)
			this.addSplineValue(sp, 0.45, sp8, 0.0)
			this.addSplineValue(sp, 0.55, sp8, 0.0)
			this.addSplineValue(sp, 0.58, sp7, 0.0)
		}

		this.addSplineValue(sp, 0.7, sp9, 0.0)
		return sp
	}

	// TODO: convert to a pre-generated variable
	initBiomeNoise() {
		const splineStack = this.biomeNoise.splineStack
		const spline = splineStack.stack[splineStack.length++]

		const sp1 = this.createLandSpline([-0.15, 0.0, 0.0, 0.1, 0.0, -0.03], 0)
		const sp2 = this.createLandSpline([-0.1, 0.03, 0.1, 0.1, 0.01, -0.03], 0)
		const sp3 = this.createLandSpline([-0.1, 0.03, 0.1, 0.7, 0.01, -0.03], 1)
		const sp4 = this.createLandSpline([-0.05, 0.03, 0.1, 1.0, 0.01, 0.01], 1)

		this.addSplineValue(spline, -1.1, this.createFixedSpline(0.044), 0.0)
		this.addSplineValue(spline, -1.02, this.createFixedSpline(-0.2222), 0.0)
		this.addSplineValue(spline, -0.51, this.createFixedSpline(-0.2222), 0.0)
		this.addSplineValue(spline, -0.44, this.createFixedSpline(-0.12), 0.0)
		this.addSplineValue(spline, -0.18, this.createFixedSpline(-0.12), 0.0)
		this.addSplineValue(spline, -0.16, sp1, 0.0)
		this.addSplineValue(spline, -0.15, sp1, 0.0)
		this.addSplineValue(spline, -0.1, sp2, 0.0)
		this.addSplineValue(spline, 0.25, sp3, 0.0)
		this.addSplineValue(spline, 1.0, sp4, 0.0)

		this.biomeNoise.spline = spline
	}

	getBiomes(range: Range) {
		const sha = this.sha
		if (range.sy === 0) range.sy = 1
		const siz = multiply64(BigInt(range.sx), BigInt(range.sy * range.sz))
		let res: BiomeValue[] = []

		if (range.scale === 1) {
			const s = this.getVoronoiSrcRange(range)
			let src: BiomeValue[] | null = null

			if (siz > 1) {
				src = []
				const sizArr: BiomeValue[] = []
				for (let i = 0; i < siz; i++) sizArr.push(0)
				this.genBiomeNoise3D(src, s, false)
				res = [...sizArr, ...src]
			}

			let p = 0
			for (let k = 0; k < range.sy; k++) {
				for (let j = 0; j < range.sz; j++) {
					for (let i = 0; i < range.sx; i++) {
						const [x4, y4, z4] = this.voronoiAccess3D(sha, range.x + i, range.y + k, range.z + j)
						if (src) {
							const xi4 = x4 - s.x
							const yi4 = y4 - s.y
							const zi4 = z4 - s.z
							res[p] = src[yi4 * s.sx * s.sz + zi4 * s.sx + xi4]
						} else {
							res[p] = this.sampleBiomeNoise(x4, y4, z4, true, true)
						}
						p++
					}
				}
			}
		} else {
			this.betterGenBiomeNoise3D(res, range, range.scale > 4)
		}

		return res
	}

	getVoronoiSrcRange(r: Range) {
		if (r.scale !== 1) throw new Error('Invalid scale')

		const x = r.x - 2
		const z = r.z - 2
		const s: Range = {
			scale: 4,
			x: x >> 2,
			z: z >> 2,
			sx: ((x + r.sx) >> 2) - (x >> 2) + 2,
			sz: ((z + r.sz) >> 2) - (z >> 2) + 2,
			y: 0,
			sy: 1,
			mapScale: 0
		}

		if (r.sy < 1) {
			s.y = 0
			s.sy = 0
		} else {
			const ty = r.y - 2
			s.y = ty >> 2
			s.sy = ((ty + r.sy) >> 2) - s.y + 2
		}

		return s
	}

	betterGenBiomeNoise3D(result: number[], r: Range, shouldPreserveDat: boolean) {
		if (r.sx === 1 && r.sy === 1) {
			const e = this.sampleBiomeNoise(r.x, r.y, r.z, true, false)
			result.push(e)
			return
		}

		const x = r.sx === 1 ? 1 : Math.floor(r.sx / 2) * r.scale
		const x1 = x * -1
		const x2 = x
		const z = r.sz === 1 ? 1 : Math.floor(r.sz / 2) * r.scale
		const z1 = z * -1
		const z2 = z

		for (let j = z1; j < z2; j++) {
			for (let i = x1; i < x2; i++) {
				result.push(this.sampleBiomeNoise(r.x + i, r.y, r.z + j, true, shouldPreserveDat))
			}
		}
	}

	genBiomeNoise3D(result: number[], r: Range, shouldPreserveDat: boolean) {
		let p = 0

		const scale = r.scale > 4 ? Math.floor(r.scale / 4) : 1
		const mid = Math.floor(scale / 2)

		const y = r.sy
		const x = r.sx
		const z = r.sz

		for (let k = 0; k < y; k++) {
			let yk = r.y + k
			for (let j = 0; j < z; j++) {
				let zj = (r.z + j) * scale + mid
				for (let i = 0; i < x; i++) {
					let xi = (r.x + i) * scale + mid
					result[p] = this.sampleBiomeNoise(xi, yk, zj, true, shouldPreserveDat)
					p++
				}
			}
		}
	}

	voronoiAccess3D(sha: bigint, x: number, y: number, z: number) {
		x -= 2
		y -= 2
		z -= 2

		const pX = rightShift32(x, 2)
		const pY = rightShift32(y, 2)
		const pZ = rightShift32(z, 2)

		const dx = (x & 3) * 10240
		const dy = (y & 3) * 10240
		const dz = (z & 3) * 10240

		let ax = 0
		let ay = 0
		let az = 0
		let dmin = 2 ** 64 - 1

		for (let i = 0; i < 8; i++) {
			const bx = Number((i & 4) !== 0)
			const by = Number((i & 2) !== 0)
			const bz = Number((i & 1) !== 0)
			const cx = pX + bx
			const cy = pY + by
			const cz = pZ + bz

			const res = this.getVoronoiCell(sha, cx, cy, cz)

			let rx = res[0] + dx - 40 * 1024 * bx
			let ry = res[1] + dy - 40 * 1024 * by
			let rz = res[2] + dz - 40 * 1024 * bz

			const d = rx * rx + ry * ry + rz * rz
			if (d < dmin) {
				dmin = d
				ax = cx
				ay = cy
				az = cz
			}
		}

		return [ax, ay, az]
	}

	getVoronoiCell(sha: bigint, a: number, b: number, c: number) {
		let s = sha

		for (let i = 0; i < 2; i++) {
			s = this.mcStepSeed(s, intToUint64(a))
			s = this.mcStepSeed(s, intToUint64(b))
			s = this.mcStepSeed(s, intToUint64(c))
		}

		const x = (Number(rightShift64(s, 24n) & 1023n) - 512) * 36
		s = this.mcStepSeed(s, sha)
		const y = (Number(rightShift64(s, 24n) & 1023n) - 512) * 36
		s = this.mcStepSeed(s, sha)
		const z = (Number(rightShift64(s, 24n) & 1023n) - 512) * 36

		return [x, y, z]
	}

	mcStepSeed(s: bigint, salt: bigint) {
		return add64(
			multiply64(s, add64(multiply64(s, 6364136223846793005n), 1442695040888963407n)),
			salt
		)
	}

	sampleBiomeNoise(
		x: number,
		y: number,
		z: number,
		isFullSampling: false,
		shouldShift: boolean,
		np?: number[]
	): null
	sampleBiomeNoise(
		x: number,
		y: number,
		z: number,
		isFullSampling: true,
		shouldShift: boolean,
		np?: number[]
	): BiomeValue
	sampleBiomeNoise(
		x: number,
		y: number,
		z: number,
		isFullSampling: boolean,
		shouldShift: boolean,
		np?: number[]
	): BiomeValue | null {
		const bn = this.biomeNoise
		const p_np: number[] = np || new Array(6).fill(0)

		if (bn.climateType >= 0) {
			return (10000.0 * this.sampleClimateParams(p_np, x, z)) as BiomeValue
		}

		let t = 0,
			h = 0,
			c = 0,
			e = 0,
			d = 0,
			w = 0
		let px = x,
			pz = z

		if (!shouldShift) {
			px += this.sampleDoublePerlinNoise(bn.climate[Climate.PeaksAndValleys], x, 0, z) * 4
			pz += this.sampleDoublePerlinNoise(bn.climate[Climate.PeaksAndValleys], z, x, 0) * 4
		}

		c = this.sampleDoublePerlinNoise(bn.climate[Climate.Continentalness], px, 0, pz)
		e = this.sampleDoublePerlinNoise(bn.climate[Climate.Erosion], px, 0, pz)
		w = this.sampleDoublePerlinNoise(bn.climate[Climate.Weirdness], px, 0, pz)

		if (isFullSampling) {
			const np_param = [c, e, -3.0 * (Math.abs(Math.abs(w) - 0.6666667) - 0.33333334), w]

			const s = this.getSpline(np_param, bn.spline)
			const off = s + 0.015

			d = 1 - (y << 2) / 128 - 83 / 160 + off
		}

		t = this.sampleDoublePerlinNoise(bn.climate[Climate.Temperature], px, 0, pz)
		h = this.sampleDoublePerlinNoise(bn.climate[Climate.Humidity], px, 0, pz)

		p_np[0] = Math.trunc(10000 * t)
		p_np[1] = Math.trunc(10000 * h)
		p_np[2] = Math.trunc(10000 * c)
		p_np[3] = Math.trunc(10000 * e)
		p_np[4] = Math.trunc(10000 * d)
		p_np[5] = Math.trunc(10000 * w)

		if (isFullSampling) return this.genOverworld(p_np)

		return null
	}

	sampleDoublePerlinNoise(noise: DoublePerlinNoise, x: number, y: number, z: number) {
		const f = 337 / 331
		let v = 0

		v += this.sampleOctaveNoise(noise.octaveNoise1, x, y, z)
		v += this.sampleOctaveNoise(noise.octaveNoise2, x * f, y * f, z * f)

		return v * noise.amplitude
	}

	sampleOctaveNoise(noise: OctaveNoise, x: number, y: number, z: number) {
		let v = 0
		// TODO: check if octaveCount can be replaced with octaves.length
		for (let i = 0; i < noise.octaveCount; i++) {
			let p = noise.octaves[i]
			let lf = p.lacunarity
			let ax = x * lf
			let ay = y * lf
			let az = z * lf
			let pv = this.samplePerlinNoise(p, ax, ay, az, 0, 0)
			v += p.amplitude * pv
		}
		return v
	}

	samplePerlinNoise(
		noise: PerlinNoise,
		d1: number,
		d2: number,
		d3: number,
		yamp: number,
		ymin: number
	) {
		d1 += noise.a
		d2 += noise.b
		d3 += noise.c
		const idx = noise.d
		const i1 = Math.floor(d1)
		const i2 = Math.floor(d2)
		const i3 = Math.floor(d3)
		d1 -= i1
		d2 -= i2
		d3 -= i3
		const t1 = d1 * d1 * d1 * (d1 * (d1 * 6.0 - 15.0) + 10.0)
		const t2 = d2 * d2 * d2 * (d2 * (d2 * 6.0 - 15.0) + 10.0)
		const t3 = d3 * d3 * d3 * (d3 * (d3 * 6.0 - 15.0) + 10.0)

		if (yamp) {
			const yclamp = ymin < d2 ? ymin : d2
			d2 -= Math.floor(yclamp / yamp) * yamp
		}

		const i = i1 & 0xff
		const j = i2 & 0xff
		const k = i3 & 0xff

		const a1 = idx[i] + j
		const b1 = idx[i + 1] + j

		const a2 = idx[a1] + k
		const a3 = idx[a1 + 1] + k
		const b2 = idx[b1] + k
		const b3 = idx[b1 + 1] + k

		let l1 = this.getIndexedLerp(idx[a2], d1, d2, d3)
		let l2 = this.getIndexedLerp(idx[b2], d1 - 1, d2, d3)
		let l3 = this.getIndexedLerp(idx[a3], d1, d2 - 1, d3)
		let l4 = this.getIndexedLerp(idx[b3], d1 - 1, d2 - 1, d3)
		let l5 = this.getIndexedLerp(idx[a2 + 1], d1, d2, d3 - 1)
		let l6 = this.getIndexedLerp(idx[b2 + 1], d1 - 1, d2, d3 - 1)
		let l7 = this.getIndexedLerp(idx[a3 + 1], d1, d2 - 1, d3 - 1)
		let l8 = this.getIndexedLerp(idx[b3 + 1], d1 - 1, d2 - 1, d3 - 1)

		l1 = lerp(t1, l1, l2)
		l3 = lerp(t1, l3, l4)
		l5 = lerp(t1, l5, l6)
		l7 = lerp(t1, l7, l8)

		l1 = lerp(t2, l1, l3)
		l5 = lerp(t2, l5, l7)

		return lerp(t3, l1, l5)
	}

	sampleClimateParams(np: number[], x: number, z: number) {
		const bn = this.biomeNoise

		if (bn.climateType == Climate.PeaksAndValleys) {
			const c = this.sampleDoublePerlinNoise(bn.climate[Climate.Continentalness], x, 0, z)
			const e = this.sampleDoublePerlinNoise(bn.climate[Climate.Erosion], x, 0, z)
			const w = this.sampleDoublePerlinNoise(bn.climate[Climate.Weirdness], x, 0, z)
			const np_param = [c, e, -3.0 * (Math.abs(Math.abs(w) - 0.6666667) - 0.33333334), w]
			const off = this.getSpline(np_param, bn.spline) + 0.015

			const y = 0
			const d = 1.0 - Number(leftShift64(BigInt(y), 2n)) / 128.0 - 83.0 / 160.0 + off

			np[2] = parseInt(String(10000.0 * c))
			np[3] = parseInt(String(10000.0 * e))
			np[4] = parseInt(String(10000.0 * d))
			np[5] = parseInt(String(10000.0 * w))

			return d
		}

		const p = this.sampleDoublePerlinNoise(bn.climate[bn.climateType], x, 0, z)
		np[bn.climateType] = parseInt(String(10000.0 * p))
		return p
	}

	getIndexedLerp(idx: number, a: number, b: number, c: number) {
		switch (idx & 0xf) {
			case 0:
				return a + b
			case 1:
				return -a + b
			case 2:
				return a - b
			case 3:
				return -a - b
			case 4:
				return a + c
			case 5:
				return -a + c
			case 6:
				return a - c
			case 7:
				return -a - c
			case 8:
				return b + c
			case 9:
				return -b + c
			case 10:
				return b - c
			case 11:
				return -b - c
			case 12:
				return a + b
			case 13:
				return -b + c
			case 14:
				return -a + b
			case 15:
				return -b - c
			default:
				return 0
		}
	}

	// TODO: refactor to not have return return types
	getSpline(vals: number[], sp: FixedSpline): number
	getSpline(vals: number[], sp: Spline): number
	getSpline(vals: number[], sp: Spline | FixedSpline): FixedSpline | number {
		if (!sp || sp.length <= 0 || sp.length >= 12) {
			throw new Error('invalid params')
		}

		// TODO: check if this is an instance of FixedSpline OR the length is 1
		if (sp.length == 1) {
			if (sp instanceof Spline) return sp.value[0].value
			if (sp instanceof FixedSpline) return sp.value
		}

		if (sp instanceof FixedSpline) {
			return sp.value
		}
		const f = vals[sp.type]
		let i

		for (i = 0; i < sp.length; i++) if (sp.loc[i] >= f) break

		if (i === 0 || i === sp.length) {
			if (i) i--
			const v = this.getSpline(vals, sp.value[i])
			return v + sp.der[i] * (f - sp.loc[i])
		}

		const sp1 = sp.value[i - 1]
		const sp2 = sp.value[i]
		const g = sp.loc[i - 1]
		const h = sp.loc[i]
		const k = (f - g) / (h - g)
		const l = sp.der[i - 1]
		const m = sp.der[i]

		const n = this.getSpline(vals, sp1)
		const o = this.getSpline(vals, sp2)
		const p = l * (h - g) - (o - n)
		const q = -m * (h - g) + (o - n)

		return lerp(k, n, o) + k * (1.0 - k) * lerp(k, p, q)
	}

	genOverworld(np: number[]) {
		let alt = 0
		let ds = MAX_UINT64
		let idx = this.getNode(np, 0, alt, ds, 0)
		let node = BIOME_TREE[idx]
		const result = Number(rightShift64(node, 48n) & 0xffn)
		if (!this.isBiomeValue(result)) throw new Error(`invalid biome value: ${result}`)

		return result
	}

	getDistance(np: number[], index: number) {
		const node = BIOME_TREE[index] ?? 0
		let ds = 0n
		for (let i = 0; i < np.length; i++) {
			let idx = Number(rightShift64(node, 8n * BigInt(i)) & 0xffn)
			let a = intToUint64(BigInt(np[i]) - BIOME_PARAMS[idx][1])
			let b = intToUint64(BIOME_PARAMS[idx][0] - BigInt(np[i]))
			let d = uint64ToInt64(a) > 0 ? a : uint64ToInt64(b) > 0 ? b : 0n
			d = multiply64(d, d)
			ds += d
		}

		return intToUint64(ds)
	}

	isBiomeValue(id: number): id is BiomeValue {
		return BIOME_VALUES.includes(id as BiomeValue)
	}

	getNode(np: number[], idx: number, alt: number, ds: bigint, depth: number) {
		let dsx = ds
		let depthx = depth

		if (depthx >= 5) return idx

		const steps = [1296 + 216 + 36 + 6 + 1, 216 + 36 + 6 + 1, 36 + 6 + 1, 6 + 1, 1]

		let step
		do {
			if (depthx >= 5) throw new Error('Invalid depth')
			step = steps[depthx]
			depthx++
		} while (idx + step >= BIOME_TREE.length)

		let node = BIOME_TREE[idx]
		let inner = Number(rightShift64(node, 48n))
		let leaf = alt

		for (let i = 0; i < 6; i++) {
			let innerDs = this.getDistance(np, inner)
			if (innerDs < dsx) {
				let leaf2 = this.getNode(np, inner, leaf, ds, depthx)
				let dsLeaf2 = inner === leaf2 ? innerDs : this.getDistance(np, leaf2)
				if (dsLeaf2 < dsx) {
					dsx = dsLeaf2
					leaf = leaf2
				}
			}

			inner += step
			if (inner >= BIOME_TREE.length) break
		}

		return leaf
	}

	nextLong(seed: bigint) {
		return add64(leftShift64(BigInt(this.next(seed, 32n)[1]), 32n), BigInt(this.next(seed, 32n)[1]))
	}

	chunkGenerateRnd(seed: bigint, chunkX: number, chunkZ: number) {
		let rnd = this.setSeed(seed)

		rnd = xor64(
			xor64(
				multiply64(this.nextLong(rnd), intToUint64(chunkX)),
				multiply64(this.nextLong(rnd), intToUint64(chunkZ))
			),
			seed
		)

		return this.setSeed(rnd)
	}

	getBiomeAt(scale: number, x: number, y: number, z: number) {
		const range: Range = { scale, x, z, y, sx: 1, sz: 1, sy: 1, mapScale: 0 }
		const id = this.getBiomes(range)
		return id[0]
	}

	getVariant(structType: Structure, seed: bigint, x: number, z: number, biomeID: number) {
		const r: Partial<StructureVariant> = {}
		let t
		let sx, sy, sz
		const rng = this.chunkGenerateRnd(seed, x >> 4, z >> 4)

		r.start = -1
		r.biome = biomeID

		switch (structType) {
			case STRUCTURE.Village:
				if (!this.isViableFeatureBiome(STRUCTURE.Village, biomeID)) {
					return null
				}

				r.rotation = this.nextInt(rng, 4)

				switch (biomeID) {
					case BIOME.Meadow:
					case BIOME.Beach:
					case BIOME.Plains:
						t = this.nextInt(rng, 204)
						if (t < 50) {
							r.start = 0
							sx = 9
							sy = 4
							sz = 9
						} else if (t < 100) {
							r.start = 1
							sx = 10
							sy = 7
							sz = 10
						} else if (t < 150) {
							r.start = 2
							sx = 8
							sy = 5
							sz = 15
						} else if (t < 200) {
							r.start = 3
							sx = 11
							sy = 9
							sz = 11
						} else if (t < 201) {
							r.start = 0
							sx = 9
							sy = 4
							sz = 9
							r.abandoned = true
						} else if (t < 202) {
							r.start = 1
							sx = 10
							sy = 7
							sz = 10
							r.abandoned = true
						} else if (t < 203) {
							r.start = 2
							sx = 8
							sy = 5
							sz = 15
							r.abandoned = true
						} else if (t < 204) {
							r.start = 3
							sx = 11
							sy = 9
							sz = 11
							r.abandoned = true
						} else {
							throw new Error('UNREACHABLE')
						}
						break
					case BIOME.Desert:
						t = this.nextInt(rng, 250)
						if (t < 98) {
							r.start = 1
							sx = 17
							sy = 6
							sz = 9
						} else if (t < 196) {
							r.start = 2
							sx = 12
							sy = 6
							sz = 12
						} else if (t < 245) {
							r.start = 3
							sx = 15
							sy = 6
							sz = 15
						} else if (t < 247) {
							r.start = 1
							sx = 17
							sy = 6
							sz = 9
							r.abandoned = true
						} else if (t < 249) {
							r.start = 2
							sx = 12
							sy = 6
							sz = 12
							r.abandoned = true
						} else if (t < 250) {
							r.start = 3
							sx = 15
							sy = 6
							sz = 15
							r.abandoned = true
						} else {
							throw new Error('UNREACHABLE')
						}
						break
					case BIOME.Savanna:
						t = this.nextInt(rng, 459)
						if (t < 100) {
							r.start = 1
							sx = 14
							sy = 5
							sz = 12
						} else if (t < 150) {
							r.start = 2
							sx = 11
							sy = 6
							sz = 11
						} else if (t < 300) {
							r.start = 3
							sx = 9
							sy = 6
							sz = 11
						} else if (t < 450) {
							r.start = 4
							sx = 9
							sy = 6
							sz = 9
						} else if (t < 452) {
							r.start = 1
							sx = 14
							sy = 5
							sz = 12
							r.abandoned = true
						} else if (t < 453) {
							r.start = 2
							sx = 11
							sy = 6
							sz = 11
							r.abandoned = true
						} else if (t < 456) {
							r.start = 3
							sx = 9
							sy = 6
							sz = 11
							r.abandoned = true
						} else if (t < 459) {
							r.start = 4
							sx = 9
							sy = 6
							sz = 9
							r.abandoned = true
						} else {
							throw new Error('UNREACHABLE')
						}
						break
					case BIOME.Taiga:
						t = this.nextInt(rng, 100)
						if (t < 49) {
							r.start = 1
							sx = 22
							sy = 3
							sz = 18
						} else if (t < 98) {
							r.start = 2
							sx = 9
							sy = 7
							sz = 9
						} else if (t < 99) {
							r.start = 1
							sx = 22
							sy = 3
							sz = 18
							r.abandoned = true
						} else if (t < 100) {
							r.start = 2
							sx = 9
							sy = 7
							sz = 9
							r.abandoned = true
						} else {
							throw new Error('UNREACHABLE')
						}
						break
					case BIOME.SnowyTundra:
						t = this.nextInt(rng, 306)
						if (t < 100) {
							r.start = 1
							sx = 12
							sy = 8
							sz = 8
						} else if (t < 150) {
							r.start = 2
							sx = 11
							sy = 5
							sz = 9
						} else if (t < 300) {
							r.start = 3
							sx = 7
							sy = 7
							sz = 7
						} else if (t < 302) {
							r.start = 1
							sx = 12
							sy = 8
							sz = 8
							r.abandoned = true
						} else if (t < 303) {
							r.start = 2
							sx = 11
							sy = 5
							sz = 9
							r.abandoned = true
						} else if (t < 306) {
							r.start = 3
							sx = 7
							sy = 7
							sz = 7
							r.abandoned = true
						} else {
							throw new Error('UNREACHABLE')
						}
						break
					default:
						sx = sy = sz = 0
						return null
				}
				break
			case STRUCTURE.AncientCity:
				r.rotation = this.nextInt(rng, 4)
				r.start = 1 + this.nextInt(rng, 3)
				sx = 18
				sy = 31
				sz = 41
				r.sy = sy
				switch (r.rotation) {
					case 0:
						x = -(x > 0)
						z = -(z > 0)
						r.sx = sx
						r.sz = sz
						break
					case 1:
						x = +(x < 0) - sz
						z = -(z > 0)
						r.sx = sz
						r.sz = sx
						break
					case 2:
						x = +(x < 0) - sx
						z = +(z < 0) - sz
						r.sx = sx
						r.sz = sz
						break
					case 3:
						x = -(x > 0)
						z = +(z < 0) - sx
						r.sx = sz
						r.sz = sx
						break
				}
				sx = 13
				sz = 20
				switch (r.rotation) {
					case 0:
						r.x = x - sx
						r.z = z - sz
						break
					case 1:
						r.x = x + sz
						r.z = z - sx
						break
					case 2:
						r.x = x + sx
						r.z = z + sz
						break
					case 3:
						r.x = x - sz
						r.z = z + sx
						break
				}
				return r as StructureVariant

			default:
				return null
		}
		r.y = 0
		r.sy = sy

		switch (r.rotation) {
			case 0:
				r.x = 0
				r.z = 0
				r.sx = sx
				r.sz = sz
				break
			case 1:
				r.x = 1 - sz
				r.z = 0
				r.sx = sz
				r.sz = sx
				break
			case 2:
				r.x = 1 - sx
				r.z = 1 - sz
				r.sx = sx
				r.sz = sz
				break
			case 3:
				r.x = 0
				r.z = 1 - sx
				r.sx = sz
				r.sz = sx
				break
		}

		// TODO: refactor to immediately return StructureVariant
		return r as StructureVariant
	}

	isDeepOceanBiome(id: number) {
		return (
			id === BIOME.DeepOcean ||
			id === BIOME.DeepWarmOcean ||
			id === BIOME.DeepLukewarmOcean ||
			id === BIOME.DeepColdOcean ||
			id === BIOME.DeepFrozenOcean
		)
	}

	isOceanBiome(id: number) {
		return (
			id === BIOME.Ocean ||
			id === BIOME.FrozenOcean ||
			id === BIOME.WarmOcean ||
			id === BIOME.LukewarmOcean ||
			id === BIOME.ColdOcean
		)
	}

	isOceanicBiome(id: number) {
		return this.isOceanBiome(id) || this.isDeepOceanBiome(id)
	}

	isViableFeatureBiome(strcutre: Structure, id: number) {
		switch (strcutre) {
			case STRUCTURE.DesertPyramid:
				return id == BIOME.Desert || id == BIOME.DesertHills

			case STRUCTURE.JunglePyramid:
				return (
					id == BIOME.Jungle ||
					id == BIOME.JungleHills ||
					id == BIOME.BambooJungle ||
					id == BIOME.BambooJungleHills
				)

			case STRUCTURE.SwampHut:
				return id == BIOME.Swamp

			case STRUCTURE.Igloo:
				return id == BIOME.SnowyTundra || id == BIOME.SnowyTaiga || id == BIOME.SnowySlopes

			case STRUCTURE.OceanRuins:
				return this.isOceanicBiome(id)

			case STRUCTURE.Shipwreck:
				return this.isOceanicBiome(id) || id == BIOME.Beach || id == BIOME.SnowyBeach

			case STRUCTURE.RuinedPortal:
				return true

			case STRUCTURE.AncientCity:
				return id == BIOME.DeepDark

			case STRUCTURE.OceanMonument:
				return this.isDeepOceanBiome(id)

			case STRUCTURE.PillagerOutpost:
				switch (id) {
					case BIOME.Desert:
					case BIOME.Plains:
					case BIOME.Savanna:
					case BIOME.SnowyPlains:
					case BIOME.Taiga:
					case BIOME.Meadow:
					case BIOME.FrozenPeaks:
					case BIOME.JaggedPeaks:
					case BIOME.StonyPeaks:
					case BIOME.SnowySlopes:
					case BIOME.Grove:
						return true
					default:
						return false
				}

			case STRUCTURE.Village:
				return (
					id == BIOME.Plains ||
					id == BIOME.Desert ||
					id == BIOME.Savanna ||
					id == BIOME.Taiga ||
					id == BIOME.SnowyTundra ||
					id == BIOME.Meadow ||
					// TODO: check if it's correct
					id == BIOME.Beach
				)

			case STRUCTURE.Mansion:
				return id == BIOME.DarkForest || id == BIOME.DarkForestHills

			default:
				throw new Error('Invalid structure')
		}
	}

	doesBiomeIdMatch(id: BiomeValue, b: bigint, m: bigint) {
		return id < 128 ? !!(b & xor64(1n, BigInt(id))) : !!(m & xor64(1n, BigInt(id - 128)))
	}

	areBiomesViable(
		x: number,
		y: number,
		z: number,
		rad: number,
		validB: bigint,
		validM: bigint,
		approx: number
	) {
		const x1 = (x - rad) >> 2,
			x2 = (x + rad) >> 2,
			sx = x2 - x1 + 1
		const z1 = (z - rad) >> 2,
			z2 = (z + rad) >> 2,
			sz = z2 - z1 + 1
		let id,
			viable = 1

		y = (y - rad) >> 2

		const corners = [
			{ x: x1, z: z1 },
			{ x: x2, z: z2 },
			{ x: x1, z: z2 },
			{ x: x2, z: z1 }
		]

		for (let i = 0; i < 4; i++) {
			id = this.getBiomeAt(4, corners[i].x, y, corners[i].z)
			if (!this.doesBiomeIdMatch(id, validB, validM)) return false
		}

		if (approx >= 1) return true

		for (let i = 0; i < sx; i++) {
			for (let j = 0; j < sz; j++) {
				id = this.sampleBiomeNoise(x1 + i, y, z1 + j, true, true)
				if (!this.doesBiomeIdMatch(id, validB, validM)) return false
			}
		}

		return viable
	}

	isViableStructureTerrain(structType: Structure, x: number, z: number) {
		let sx, sz
		if (structType === STRUCTURE.DesertPyramid || structType === STRUCTURE.JunglePyramid) {
			sx = structType === STRUCTURE.DesertPyramid ? 21 : 12
			sz = structType === STRUCTURE.DesertPyramid ? 21 : 15
		} else if (structType === STRUCTURE.Mansion) {
			const cx = x >> 4,
				cz = z >> 4
			const rng = this.chunkGenerateRnd(this.seed, cx, cz)
			const rot = this.nextInt(rng, 4)
			sx = 5
			sz = 5
			if (rot === 0) {
				sx = -5
			}
			if (rot === 1) {
				sx = -5
				sz = -5
			}
			if (rot === 2) {
				sz = -5
			}
			x = (cx << 4) + 7
			z = (cz << 4) + 7
		} else {
			return 1
		}

		const corners = [
			[(x + 0) / 4.0, (z + 0) / 4.0],
			[(x + sx) / 4.0, (z + sz) / 4.0],
			[(x + 0) / 4.0, (z + sz) / 4.0],
			[(x + sx) / 4.0, (z + 0) / 4.0]
		]

		const temp = this.biomeNoise.climateType
		this.biomeNoise.climateType = Climate.PeaksAndValleys

		for (let i = 0; i < 4; i++) {
			const depth = this.sampleClimateParams([], corners[i][0], corners[i][1])
			if (depth < 0.48) return false
		}

		this.biomeNoise.climateType = temp
		return true
	}

	isViableStructurePosition(structureType: Structure, x: number, z: number) {
		let approx = 0

		let chunkX = x >> 4
		let chunkZ = z >> 4

		let sampleX, sampleZ, sampleY
		let id

		switch (structureType) {
			case STRUCTURE.OceanRuins:
			case STRUCTURE.Shipwreck:
			case STRUCTURE.Igloo:
			case STRUCTURE.DesertPyramid:
			case STRUCTURE.JunglePyramid:
			case STRUCTURE.SwampHut:
				sampleX = (chunkX << 2) + 2
				sampleZ = (chunkZ << 2) + 2
				id = this.getBiomeAt(4, sampleX, 319 >> 2, sampleZ)
				if (id < 0 || !this.isViableFeatureBiome(structureType, id)) return false
				return true

			case STRUCTURE.Village:
				const biomes = [
					BIOME.Plains,
					BIOME.Desert,
					BIOME.Savanna,
					BIOME.Taiga,
					BIOME.SnowyTundra,
					BIOME.Meadow,
					BIOME.Beach
				]

				for (const biome of biomes) {
					const sv = this.getVariant(STRUCTURE.Village, this.seed, x, z, biome)
					if (!sv) continue

					id = this.getBiomeAt(1, x, 70, z)

					if (id === biome) return true
				}

				return false

			case STRUCTURE.PillagerOutpost: {
				let rng = this.seed
				this.setAttemptSeed(rng, chunkX, chunkZ)
				if (this.nextInt(rng, 5) !== 0) return false

				const vilconf = this.getStructureConfig(STRUCTURE.Village)
				if (!vilconf) return false

				const cx0 = chunkX - 10
				const cx1 = chunkX + 10
				const cz0 = chunkZ - 10
				const cz1 = chunkZ + 10
				const rx0 = Math.floor(cx0 / Number(vilconf.regionSize)) - (cx0 < 0 ? 1 : 0)
				const rx1 = Math.floor(cx1 / Number(vilconf.regionSize)) - (cx1 < 0 ? 1 : 0)
				const rz0 = Math.floor(cz0 / Number(vilconf.regionSize)) - (cz0 < 0 ? 1 : 0)
				const rz1 = Math.floor(cz1 / Number(vilconf.regionSize)) - (cz1 < 0 ? 1 : 0)
				let rx, rz

				for (rz = rz0; rz <= rz1; rz++) {
					for (rx = rx0; rx <= rx1; rx++) {
						const p = this.getFeaturePosition(vilconf, this.seed, rx, rz)
						const cx = p.x >> 4,
							cz = p.z >> 4
						if (cx >= cx0 && cx <= cx1 && cz >= cz0 && cz <= cz1) {
							return false
						}
					}
				}

				rng = this.chunkGenerateRnd(this.seed, chunkX, chunkZ)
				switch (this.nextInt(rng, 4)) {
					case 0:
						sampleX = +15
						sampleZ = +15
						break
					case 1:
						sampleX = -15
						sampleZ = +15
						break
					case 2:
						sampleX = -15
						sampleZ = -15
						break
					case 3:
						sampleX = +15
						sampleZ = -15
						break
					default:
						return false
				}
				sampleX = (((chunkX << 5) + sampleX) / 2) >> 2
				sampleZ = (((chunkZ << 5) + sampleZ) / 2) >> 2
				id = this.getBiomeAt(4, sampleX, 319 >> 2, sampleZ)
				if (id < 0 || !this.isViableFeatureBiome(structureType, id)) {
					return false
				}
				return true
			}

			case STRUCTURE.OceanMonument: {
				sampleX = (chunkX << 4) + 8
				sampleZ = (chunkZ << 4) + 8
				id = this.getBiomeAt(4, sampleX >> 2, 36 >> 2, sampleZ >> 2)
				if (!this.isDeepOceanBiome(id)) {
					return false
				}
				if (this.areBiomesViable(sampleX, 63, sampleZ, 29, MONUMENT_BIOMES_BINARY, 0n, approx)) {
					return true
				}
				return false
			}

			case STRUCTURE.Mansion: {
				sampleX = (chunkX << 4) + 7
				sampleZ = (chunkZ << 4) + 7
				id = this.getBiomeAt(4, sampleX >> 2, 319 >> 2, sampleZ >> 2)
				if (id < 0 || !this.isViableFeatureBiome(structureType, id)) {
					return false
				}
				return true
			}

			case STRUCTURE.RuinedPortal: {
				return true
			}

			case STRUCTURE.AncientCity: {
				const sv = this.getVariant(STRUCTURE.AncientCity, this.seed, x, z, -1)
				if (!sv) return false

				sampleX = (((chunkX << 5) + 2 * sv.x + sv.sx) / 2) >> 2
				sampleZ = (((chunkZ << 5) + 2 * sv.z + sv.sz) / 2) >> 2
				sampleY = -27 >> 2
				id = this.getBiomeAt(1, sampleX, sampleY, sampleZ)
				if (id < 0 || !this.isViableFeatureBiome(structureType, id)) {
					return false
				}
				return true
			}

			default:
				return false
		}
	}
}
