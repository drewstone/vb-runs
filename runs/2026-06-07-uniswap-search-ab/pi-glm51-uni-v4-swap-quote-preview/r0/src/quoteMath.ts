/**
 * Swap quote computation using direct V4 SqrtPriceMath calls.
 *
 * Uses getNextSqrtPriceFromInput, getAmount0Delta, getAmount1Delta from our
 * sqrtPriceMath.ts — a pure-BigInt reimplementation of the V4 core Solidity math.
 * No dependency on Pool.getOutputAmount or @uniswap/v3-sdk.
 */

import {
  getNextSqrtPriceFromInput,
  getAmount0Delta,
  getAmount1Delta,
} from './sqrtPriceMath'

export interface QuoteResult {
  outputHuman: number
  outputRaw: bigint
  newSqrtPriceX96: bigint
  midPrice: number
  execPrice: number
  priceImpact: number
  zeroForOne: boolean
  steps: Step[]
}

interface Step {
  label: string
  value: string
  highlight?: boolean
}

/**
 * Compute a swap quote using direct V4 SqrtPriceMath (pure BigInt).
 *
 * For zeroForOne (token0 → token1):
 *   newSqrtPrice = getNextSqrtPriceFromInput(√P, L, amountIn, true)
 *   output       = getAmount1Delta(newSqrtPrice, √P, L, false)
 *
 * For oneForZero (token1 → token0):
 *   newSqrtPrice = getNextSqrtPriceFromInput(√P, L, amountIn, false)
 *   output       = getAmount0Delta(√P, newSqrtPrice, L, false)
 */
export function computeQuote(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  _tick: number,
  inputDecimals: number,
  outputDecimals: number,
  zeroForOne: boolean,
  inputAmountHuman: string,
): QuoteResult | null {
  if (!inputAmountHuman || parseFloat(inputAmountHuman) <= 0) return null

  // Parse human input → raw BigInt
  const parts = inputAmountHuman.split('.')
  const intPart = parts[0] || '0'
  const fracPart = (parts[1] || '').slice(0, inputDecimals)
  const fracPadded = fracPart.padEnd(inputDecimals, '0')
  const amountInRaw = BigInt(intPart) * 10n ** BigInt(inputDecimals) + BigInt(fracPadded || '0')

  if (amountInRaw <= 0n) return null

  const steps: Step[] = []

  // Step 1: Compute new sqrt price from input
  const newSqrtPriceX96 = getNextSqrtPriceFromInput(
    sqrtPriceX96, liquidity, amountInRaw, zeroForOne,
  )

  // Step 2: Compute output amount
  let outputRaw: bigint
  if (zeroForOne) {
    // token0 → token1: output = getAmount1Delta(newSqrtPrice, oldSqrtPrice, L)
    outputRaw = getAmount1Delta(newSqrtPriceX96, sqrtPriceX96, liquidity, false)
    steps.push({ label: 'Direction', value: 'token0 → token1 (zeroForOne)' })
    steps.push({ label: 'Next price', value: 'getNextSqrtPriceFromInput(√P, L, Δin, true)' })
    steps.push({ label: 'Output', value: 'getAmount1Delta(√P_new, √P, L, false)' })
  } else {
    // token1 → token0: output = getAmount0Delta(oldSqrtPrice, newSqrtPrice, L)
    outputRaw = getAmount0Delta(sqrtPriceX96, newSqrtPriceX96, liquidity, false)
    steps.push({ label: 'Direction', value: 'token1 → token0 (oneForZero)' })
    steps.push({ label: 'Next price', value: 'getNextSqrtPriceFromInput(√P, L, Δin, false)' })
    steps.push({ label: 'Output', value: 'getAmount0Delta(√P, √P_new, L, false)' })
  }

  if (outputRaw <= 0n) return null

  // Human-readable output
  const outputHuman = Number(outputRaw) / 10 ** outputDecimals
  const inputHuman = Number(amountInRaw) / 10 ** inputDecimals

  // Mid price: (sqrtPriceX96 / 2^96)^2 in raw, converted to human terms
  const sqrtPriceFloat = Number(sqrtPriceX96) / Number(2n ** 96n)
  const priceRawFloat = sqrtPriceFloat * sqrtPriceFloat

  // midPrice = how much output token per 1 input token
  let midPrice: number
  if (zeroForOne) {
    // price_raw = token1/token0 in raw → human: * 10^dec0 / 10^dec1
    midPrice = priceRawFloat * 10 ** (inputDecimals - outputDecimals)
  } else {
    // inverse: token0/token1 in raw → human: (1/price) * 10^dec1 / 10^dec0
    midPrice = (1 / priceRawFloat) * 10 ** (inputDecimals - outputDecimals)
  }

  // Execution price = output_human / input_human
  const execPrice = outputHuman / inputHuman

  // Price impact = |midPrice - execPrice| / midPrice * 100
  const priceImpact = midPrice > 0
    ? Math.abs((midPrice - execPrice) / midPrice) * 100
    : 0

  steps.push({ label: 'sqrtPriceX96 (before)', value: sqrtPriceX96.toString() })
  steps.push({ label: 'sqrtPriceX96 (after)', value: newSqrtPriceX96.toString(), highlight: true })
  steps.push({ label: 'Output (raw)', value: outputRaw.toString(), highlight: true })

  return {
    outputHuman,
    outputRaw,
    newSqrtPriceX96,
    midPrice: isFinite(midPrice) ? midPrice : 0,
    execPrice: isFinite(execPrice) ? execPrice : 0,
    priceImpact: isFinite(priceImpact) ? priceImpact : 0,
    zeroForOne,
    steps,
  }
}
