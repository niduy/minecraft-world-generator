import { expect, test } from 'vitest'
import {
	add64,
	subtract64,
	MAX_UINT64,
	multiply64,
	xor64,
	intToUint64,
	uint64ToInt32
} from './math'

test('add64', () => {
	expect(add64(MAX_UINT64, 0n)).toBe(MAX_UINT64)
	expect(add64(0n, MAX_UINT64)).toBe(MAX_UINT64)
	expect(add64(MAX_UINT64, 1n)).toBe(0n)
	expect(add64(1n, MAX_UINT64)).toBe(0n)
	expect(add64(66666n, 77777n)).toBe(144443n)
	expect(add64(6422578n, MAX_UINT64)).toBe(6422577n)
	expect(add64(1515151515n, 5454545454n)).toBe(6969696969n)
	expect(add64(MAX_UINT64, MAX_UINT64)).toBe(MAX_UINT64 - 1n)
})

test('subtract64', () => {
	expect(subtract64(1n, 2n)).toBe(MAX_UINT64)
	expect(subtract64(2n, 3n)).toBe(MAX_UINT64)
	expect(subtract64(6969696969n, 5454545454n)).toBe(1515151515n)
	expect(subtract64(MAX_UINT64, MAX_UINT64)).toBe(0n)
	expect(subtract64(MAX_UINT64 - 1n, MAX_UINT64)).toBe(MAX_UINT64)
})

test('multiply64', () => {
	expect(multiply64(424242n, 333333n)).toBe(141413858586n)
	expect(multiply64(2n, MAX_UINT64)).toBe(MAX_UINT64 - 1n)
	expect(multiply64(MAX_UINT64, 2n)).toBe(MAX_UINT64 - 1n)
	expect(multiply64(5n, MAX_UINT64)).toBe(MAX_UINT64 - 4n)
	expect(multiply64(MAX_UINT64, 5n)).toBe(MAX_UINT64 - 4n)
})

test('xor64', () => {
	expect(xor64(123n, 7640891576956012809n)).toBe(7640891576956012914n)
})

test('intToUint64', () => {
	expect(intToUint64(-3)).toBe(18446744073709551613n)
	expect(intToUint64(-2)).toBe(18446744073709551614n)
	expect(intToUint64(-1)).toBe(18446744073709551615n)
	expect(intToUint64(-0)).toBe(0n)
	expect(intToUint64(1)).toBe(1n)
	expect(intToUint64(2)).toBe(2n)
})

test('uint64ToInt32', () => {
	expect(uint64ToInt32(4611686014132420609n)).toBe(1)
	expect(uint64ToInt32(18446744073709550800n)).toBe(-816)
	expect(uint64ToInt32(18446744073709551040n)).toBe(-576)
	expect(uint64ToInt32(18446744073709551296n)).toBe(-320)
	expect(uint64ToInt32(9223372036854775807n)).toBe(-1)
	expect(uint64ToInt32(922337203685477580n)).toBe(-858993460)
	expect(uint64ToInt32(9223372036854775808n)).toBe(0)
	expect(uint64ToInt32(9223372036854775809n)).toBe(1)
	expect(uint64ToInt32(2147483647n)).toBe(2147483647)
	expect(uint64ToInt32(2147483648n)).toBe(-2147483648)
	expect(uint64ToInt32(2147483649n)).toBe(-2147483647)
	expect(uint64ToInt32(2147483650n)).toBe(-2147483646)
	expect(uint64ToInt32(0n)).toBe(0)
	expect(uint64ToInt32(5555n)).toBe(5555)
})
