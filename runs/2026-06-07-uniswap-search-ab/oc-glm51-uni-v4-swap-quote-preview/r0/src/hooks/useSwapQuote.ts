import { useMemo } from 'react'
import JSBI from 'jsbi'
import { SqrtPriceMath } from '@uniswap/v3-sdk'
import type { PoolState } from './usePoolState'
import type { TokenInfo } from '../lib/constants'

export interface SwapQuoteResult {
  outputAmount: number
  outputSymbol: string
  executionPrice: number
  midPrice: number
  priceImpact: number
  feePercent: number
  newSqrtPriceX96: JSBI
  outputRaw: JSBI
  inputRaw: JSBI
}

export function useSwapQuote(
  poolState: PoolState | null,
  inputToken: TokenInfo,
  outputToken: TokenInfo,
  inputAmountHuman: string,
) {
  return useMemo<SwapQuoteResult | null>(() => {
    if (!poolState || !inputAmountHuman) return null
    const parsed = parseFloat(inputAmountHuman)
    if (!parsed || parsed <= 0 || !isFinite(parsed)) return null

    const sqrtPriceX96 = JSBI.BigInt(poolState.sqrtPriceX96.toString())
    const liquidity = JSBI.BigInt(poolState.liquidity.toString())

    const zeroForOne =
      inputToken.address.toLowerCase() <
      outputToken.address.toLowerCase()

    const inputDecimals = inputToken.decimals
    const outputDecimals = outputToken.decimals
    const feeBps = poolState.lpFee > 0 ? poolState.lpFee : poolState.protocolFee
    const feePercent = feeBps / 1_000_000 * 100

    const rawInputFloat = parsed * 10 ** inputDecimals
    const rawInputRounded = Math.round(rawInputFloat)
    if (rawInputRounded <= 0) return null

    const inputRaw = JSBI.BigInt(rawInputRounded)
    const inputAfterFee = JSBI.divide(
      JSBI.multiply(inputRaw, JSBI.BigInt(1_000_000 - feeBps)),
      JSBI.BigInt(1_000_000),
    )

    if (JSBI.LE(inputAfterFee, JSBI.BigInt(0))) return null

    const newSqrtPriceX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
      sqrtPriceX96,
      liquidity,
      inputAfterFee,
      zeroForOne,
    )

    let outputRaw: JSBI
    if (zeroForOne) {
      outputRaw = SqrtPriceMath.getAmount1Delta(
        newSqrtPriceX96,
        sqrtPriceX96,
        liquidity,
        false,
      )
    } else {
      outputRaw = SqrtPriceMath.getAmount0Delta(
        sqrtPriceX96,
        newSqrtPriceX96,
        liquidity,
        false,
      )
    }

    const outputAmount = JSBI.toNumber(outputRaw) / 10 ** outputDecimals
    if (outputAmount <= 0) return null

    const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))
    const Q192 = JSBI.multiply(Q96, Q96)
    const priceX192 = JSBI.multiply(sqrtPriceX96, sqrtPriceX96)
    const priceRawNum = Number(priceX192) / Number(Q192)
    const decimalDiff = poolState.token0.decimals - poolState.token1.decimals
    const midPriceToken1PerToken0 = priceRawNum * 10 ** decimalDiff

    let midPrice: number
    let execPrice: number
    if (zeroForOne) {
      midPrice = midPriceToken1PerToken0
      execPrice = outputAmount / parsed
    } else {
      midPrice =
        midPriceToken1PerToken0 > 0
          ? 1 / midPriceToken1PerToken0
          : 0
      execPrice = outputAmount / parsed
    }

    const priceImpact =
      midPrice > 0 ? Math.abs((midPrice - execPrice) / midPrice) * 100 : 0

    return {
      outputAmount,
      outputSymbol: outputToken.symbol,
      executionPrice: execPrice,
      midPrice,
      priceImpact,
      feePercent,
      newSqrtPriceX96,
      outputRaw,
      inputRaw,
    }
  }, [poolState, inputToken, outputToken, inputAmountHuman])
}
