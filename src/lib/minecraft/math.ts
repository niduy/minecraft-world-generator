export const MAX_UINT64 = 18_446_744_073_709_551_615n
export const MAX_UINT32 = 4_294_967_295n

const UINT64_WRAPUP = MAX_UINT64 + 1n
const UINT32_WRAPUP = MAX_UINT32 + 1n

export const lerp = (part: number, from: number, to: number) => {
	return from + part * (to - from)
}

const uint64ToInt32Buffer = new ArrayBuffer(8)
const uint64ToInt32U64View = new BigUint64Array(uint64ToInt32Buffer)
const uint64ToInt32I32View = new Int32Array(uint64ToInt32Buffer)
export const uint64ToInt32 = (x: bigint) => {
	uint64ToInt32U64View[0] = x
	return uint64ToInt32I32View[0]
}

const uint64ToInt64Buffer = new ArrayBuffer(8)
const uint64ToInt64U64View = new BigUint64Array(uint64ToInt64Buffer)
const uint64ToInt64I64View = new BigInt64Array(uint64ToInt64Buffer)
export const uint64ToInt64 = (x: bigint) => {
	uint64ToInt64U64View[0] = x
	return uint64ToInt64I64View[0]
}

export const leftShift64 = (a: bigint, b: bigint) => {
	return (a << b) & MAX_UINT64
}

export const rightShift32 = (a: number, b: number) => {
	return (a & Number(MAX_UINT32)) >> b
}

export const rightShift64 = (a: bigint, b: bigint) => {
	return (a & MAX_UINT64) >> b
}

export const rotl64 = (a: bigint, b: bigint) => {
	return or64(leftShift64(a, b), rightShift64(a, subtract64(64n, b)))
}

export const rotr32 = (a: bigint, b: bigint) => {
	return BigInt(Number(a & MAX_UINT32) >>> Number(b)) | (leftShift64(a, 32n - b) & MAX_UINT32)
}

export const or64 = (a: bigint, b: bigint) => {
	return (a | b) & MAX_UINT64
}

export const xor32 = (a: bigint, b: bigint) => {
	return (a ^ b) & MAX_UINT32
}

export const xor64 = (a: bigint, b: bigint) => {
	return (a ^ b) & MAX_UINT64
}

export const add32 = (a: bigint, b: bigint) => {
	return (a + b) % UINT32_WRAPUP
}

export const add64 = (a: bigint, b: bigint) => {
	return (a + b) % UINT64_WRAPUP
}

export const subtract64 = (a: bigint, b: bigint) => {
	return (a + UINT64_WRAPUP - b) % UINT64_WRAPUP
}

export const multiply64 = (a: bigint, b: bigint) => {
	return (a * b) % UINT64_WRAPUP
}

export const intToUint64 = (x: number | bigint) => {
	if (x < 0) return BigInt(x) + UINT64_WRAPUP
	else return BigInt(x)
}

export const bswap32 = (n: bigint) => {
	return (
		BigInt((Number(n) & 0xff000000 & Number(MAX_UINT32)) >>> 24) |
		BigInt((Number(n) & 0x00ff0000 & Number(MAX_UINT32)) >>> 8) |
		((n & 0x0000ff00n) << 8n) |
		(((n & 0x000000ffn) << 24n) & MAX_UINT32)
	)
}
