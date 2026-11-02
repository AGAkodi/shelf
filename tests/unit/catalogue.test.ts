import { describe, expect, it } from 'vitest'
import { formatUsdt } from '../../src/features/catalogue/catalogue'
describe('exact micro-USDT display', () => {
  it('retains small amounts and all six decimals', () => {
    expect(formatUsdt(1)).toBe('0.000001')
    expect(formatUsdt(2500000)).toBe('2.50')
    expect(formatUsdt(9007199254740991)).toBe('9007199254.740991')
  })
})
