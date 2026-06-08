// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";

/**
 * @title SwapQuoteHook
 * @notice A minimal Uniswap V4 hook that records pre-swap sqrtPrice and
 *         liquidity via StateLibrary, and computes a quote preview using
 *         SqrtPriceMath.getAmount0Delta / getAmount1Delta.
 *
 *         The _beforeSwap callback reads slot0 and stores the pool state.
 *         The _afterSwap callback records the executed delta.
 *
 *         Only the canonical PoolManager can invoke these callbacks via
 *         the onlyPoolManager modifier inherited from ImmutableState.
 */
contract SwapQuoteHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ───────────────────────────────────────────────────────────────────
    //  Events
    // ───────────────────────────────────────────────────────────────────

    event QuoteRecorded(
        PoolId indexed poolId,
        address indexed sender,
        uint160 sqrtPriceX96Before,
        uint160 sqrtPriceX96After,
        uint128 liquidityBefore,
        int256 amount0,
        int256 amount1,
        bool zeroForOne,
        uint256 amountSpecified
    );

    // ───────────────────────────────────────────────────────────────────
    //  State variables
    // ───────────────────────────────────────────────────────────────────

    /// @notice Pre-swap sqrtPriceX96 recorded in _beforeSwap
    mapping(PoolId poolId => uint160 sqrtPriceX96) public sqrtPriceX96Before;

    /// @notice Pre-swap liquidity recorded in _beforeSwap
    mapping(PoolId poolId => uint128 liquidity) public liquidityBefore;

    // ───────────────────────────────────────────────────────────────────
    //  Constructor
    // ───────────────────────────────────────────────────────────────────

    constructor(IPoolManager manager) BaseHook(manager) { }

    // ───────────────────────────────────────────────────────────────────
    //  Hook permissions
    // ───────────────────────────────────────────────────────────────────

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,   // record pre-swap state
            afterSwap: true,    // record executed delta
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ───────────────────────────────────────────────────────────────────
    //  _beforeSwap  —  capture pre-swap pool state via StateLibrary
    // ───────────────────────────────────────────────────────────────────

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    )
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Read the current pool slot0 and liquidity via StateLibrary
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());

        uint128 liquidity = poolManager.getLiquidity(key.toId());

        // Store for use in _afterSwap
        PoolId poolId = key.toId();
        sqrtPriceX96Before[poolId] = sqrtPriceX96;
        liquidityBefore[poolId] = liquidity;

        // ── Compute a preview quote using SqrtPriceMath ──────────────
        uint160 sqrtPriceAfter;
        uint256 amountOut;
        uint256 absAmount = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        if (params.amountSpecified > 0) {
            // Exact input
            uint160 sqrtPriceLimitX96 = params.sqrtPriceLimitX96 != uint160(0)
                ? params.sqrtPriceLimitX96
                : (params.zeroForOne ? uint160(4_295_128_739) : type(uint160).max);

            sqrtPriceAfter = SqrtPriceMath.getNextSqrtPriceFromInput(
                sqrtPriceX96,
                liquidity,
                absAmount,
                params.zeroForOne
            );

            if (params.zeroForOne) {
                // Selling token0 → output is token1
                amountOut = SqrtPriceMath.getAmount1Delta(
                    sqrtPriceX96, sqrtPriceAfter, liquidity, false
                );
            } else {
                // Selling token1 → output is token0
                amountOut = SqrtPriceMath.getAmount0Delta(
                    sqrtPriceAfter, sqrtPriceX96, liquidity, false
                );
            }
        } else {
            // Exact output
            sqrtPriceAfter = SqrtPriceMath.getNextSqrtPriceFromOutput(
                sqrtPriceX96,
                liquidity,
                absAmount,
                params.zeroForOne
            );

            if (params.zeroForOne) {
                amountOut = SqrtPriceMath.getAmount0Delta(
                    sqrtPriceX96, sqrtPriceAfter, liquidity, true
                );
            } else {
                amountOut = SqrtPriceMath.getAmount1Delta(
                    sqrtPriceX96, sqrtPriceAfter, liquidity, true
                );
            }
        }

        emit QuoteRecorded(
            poolId,
            sender,
            sqrtPriceX96,
            sqrtPriceAfter,
            liquidity,
            params.zeroForOne ? -int256(absAmount) : int256(absAmount),
            params.zeroForOne ? int256(amountOut) : -int256(amountOut),
            params.zeroForOne,
            absAmount
        );

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // ───────────────────────────────────────────────────────────────────
    //  _afterSwap  —  record the executed BalanceDelta
    // ───────────────────────────────────────────────────────────────────

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    )
        internal
        override
        returns (bytes4, int128)
    {
        PoolId poolId = key.toId();

        // Read post-swap state to get the final sqrtPrice
        (uint160 sqrtPriceAfter,,,) = poolManager.getSlot0(poolId);

        uint256 absAmount = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        emit QuoteRecorded(
            poolId,
            sender,
            sqrtPriceX96Before[poolId],
            sqrtPriceAfter,
            liquidityBefore[poolId],
            delta.amount0(),
            delta.amount1(),
            params.zeroForOne,
            absAmount
        );

        return (BaseHook.afterSwap.selector, 0);
    }
}
