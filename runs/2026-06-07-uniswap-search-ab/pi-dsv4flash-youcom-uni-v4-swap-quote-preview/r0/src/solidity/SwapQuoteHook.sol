// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

/// @title SwapQuoteHook
/// @notice Uniswap V4 hook implementing beforeSwap/afterSwap lifecycle callbacks.
///
///         Uses StateLibrary to read the pool's sqrtPriceX96 and liquidity,
///         then emits events the frontend can consume for swap quoting.
///
///         Hook permissions (address-derived flag bits):
///         - beforeSwap:  bit 3 (0x08)
///         - afterSwap:   bit 4 (0x10)
///         Combined:      0x18
contract SwapQuoteHook is BaseHook {
    using StateLibrary for IPoolManager;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted during beforeSwap with pre-swap pool state for quoting.
    event SwapQuote(
        bytes32 indexed poolId,
        uint160 sqrtPriceX96Before,
        uint128 liquidityBefore,
        int24 tickBefore,
        int256 amountSpecified,
        bool zeroForOne
    );

    /// @notice Emitted during afterSwap with the actual swap result.
    event SwapExecuted(
        bytes32 indexed poolId,
        uint160 sqrtPriceX96After,
        uint128 liquidityAfter,
        int24 tickAfter,
        BalanceDelta delta
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the hook. The contract address must encode hook permissions.
    /// @param _manager The V4 PoolManager contract
    constructor(IPoolManager _manager) BaseHook(_manager) {
        // Empty — BaseHook validates address permissions in constructor
    }

    // ──────────────────────────────────────────────
    //  Hook Permissions
    // ──────────────────────────────────────────────

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ──────────────────────────────────────────────
    //  Before Swap
    // ──────────────────────────────────────────────

    /// @notice Captures pre-swap pool state using StateLibrary for quoting.
    /// @dev StateLibrary.getSlot0() reads sqrtPriceX96 + tick from PoolManager's slot0.
    ///      StateLibrary.getLiquidity() reads the pool's in-range liquidity.
    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    )
        internal
        override
        returns (bytes4 selector, BeforeSwapDelta beforeSwapDelta, uint24 fee)
    {
        PoolId poolId = key.toId();

        // Read pre-swap state from PoolManager via StateLibrary
        (uint160 sqrtPriceX96Before, int24 tickBefore,,) = poolManager.getSlot0(poolId);
        uint128 liquidityBefore = poolManager.getLiquidity(poolId);

        emit SwapQuote(
            PoolId.unwrap(poolId),
            sqrtPriceX96Before,
            liquidityBefore,
            tickBefore,
            params.amountSpecified,
            params.zeroForOne
        );

        // Return without modifying the swap
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    // ──────────────────────────────────────────────
    //  After Swap
    // ──────────────────────────────────────────────

    /// @notice Captures post-swap state and emits the actual swap result.
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    )
        internal
        override
        returns (bytes4 selector, int128 afterSwapDelta)
    {
        PoolId poolId = key.toId();

        // Read post-swap pool state
        (uint160 sqrtPriceX96After, int24 tickAfter,,) = poolManager.getSlot0(poolId);
        uint128 liquidityAfter = poolManager.getLiquidity(poolId);

        emit SwapExecuted(PoolId.unwrap(poolId), sqrtPriceX96After, liquidityAfter, tickAfter, delta);

        return (BaseHook.afterSwap.selector, 0);
    }
}
